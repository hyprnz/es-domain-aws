import { AggregateRootRepository, AggregateRootRepositoryFactory, EntityEvent, EventStore, EventStoreBuilder, InternalEventStore, Uuid } from '@hyprnz/es-domain'
import { DynamoDB } from 'aws-sdk'
import { assertThat, match } from 'mismatched'
import { makeAWSDynamoConfig } from '../../fixtures/testEnvironment'
import { Device, InitialiseDevicePayload } from '../../testAggregate/Device'
import { DynamoDbInternalEventStore, DynamoDbInternalEventStoreConfig } from './DynamoDbInternalEventStore'
import { makeWriteStoreMigrator } from './writeStoreMigrator'

describe('DynamoDbInternalEventStore', () => {

  let dynamoRepo: InternalEventStore
  let eventStore: EventStore
  let deviceRepoistory: AggregateRootRepository<Device, InitialiseDevicePayload>

  beforeAll(async () => {

    const tableName = 'eventstore'
    const clientOptions = makeAWSDynamoConfig()


    const db = new DynamoDB(clientOptions)
    const migrate = makeWriteStoreMigrator(db, tableName)
    await migrate.down()
    await migrate.up()


    const config: DynamoDbInternalEventStoreConfig = {
      tableName: tableName,
      clock: () => new Date(),
      uuid: () => Uuid.createV4()
    }


    const client = new DynamoDB.DocumentClient({service: db})
    dynamoRepo = new DynamoDbInternalEventStore(config, client, console)
    eventStore = EventStoreBuilder.withRepository(dynamoRepo).make()
    deviceRepoistory = AggregateRootRepositoryFactory.makeRepo(eventStore, Device)
  })

  describe("DynamoDbInternalEventStore", () => {
    describe("loads, when no events", () => {
      it("getEvents", async () => {
        const someid = Uuid.createV4()
        const events = await dynamoRepo.getEvents(someid)
        assertThat(events).is([])
      })

      it("getEventsAfterVersion", async () => {
        const someid = Uuid.createV4()
        const events = await dynamoRepo.getEventsAfterVersion(someid, 10)
        assertThat(events).is([])
      })
    })

    describe("loads events", ()=>{
      let someid: Uuid.UUID
      let eventList: Array<EntityEvent>
      beforeAll(async () =>{
        someid = Uuid.createV4()
        const alarmId = Uuid.createV4()

        const [device, deviceAggregate] = await deviceRepoistory.create({ id: someid })
        device.addAlarm(alarmId)
        eventList = deviceAggregate.uncommittedChanges()
        await device.save()
      })

      it("getEvents", async () => {
        const events = await dynamoRepo.getEvents(someid)
        assertThat(events).is(eventList)
      })

      it("getEventsAfterVersion", async () => {
        const events = await dynamoRepo.getEventsAfterVersion(someid, 0)
        assertThat(events).is(eventList)
      })

      it("getEventsAfterVersion One", async () => {
        const events = await dynamoRepo.getEventsAfterVersion(someid, 1)
        assertThat(events).is([eventList[1]])
      })
    })

    describe("appendEvents", ()=>{
      let someid: Uuid.UUID
      let eventList: Array<EntityEvent>
      beforeEach(async () =>{
        someid = Uuid.createV4()
        const alarmId = Uuid.createV4()

        const [device, deviceAggregate] = await deviceRepoistory.create({ id: someid })
        device.addAlarm(alarmId)


        eventList = deviceAggregate.uncommittedChanges()
      })

      it("appends empty array of events", async ()=>{
        await dynamoRepo.appendEvents(someid, 1, [])
      })

      it("appends array of events", async ()=>{
        await dynamoRepo.appendEvents(someid, 1, eventList)
      })


      it("should fail to append duplicate events", async ()=>{
        const VERSION = 1
        await dynamoRepo.appendEvents(someid, VERSION, eventList)

          await dynamoRepo.appendEvents(someid, VERSION, eventList).then(
            () => {
              throw new Error('Expected and Optimistic concurrency error here!!')
            },
            e => assertThat(e.message).is(`Optimistic concurrency error for aggregate root id: ${someid}, version: ${VERSION}`)
          )
      })

      it("should fail to append duplicate events in single transaction", async ()=>{
        const VERSION = 1
        await dynamoRepo.appendEvents(someid, VERSION, eventList.concat(eventList)).then(
          () => {
            throw new Error('Expected and Optimistic concurrency error here!!')
          },
          e => assertThat(e.message).is(`Optimistic concurrency error for aggregate root id: ${someid}, version: ${VERSION}`)
        )
      })

      it("dynamo supports transactions spanning multiple multiple parttions/ aggregates", async () =>{
        const event = eventList[0]
        const events = [
          event,
          {
            version : event.version,
            event: {...event.event, aggregateRootId:  Uuid.createV4(), id:  Uuid.createV4()
          },
        }]

        await dynamoRepo.appendEvents(someid, 1, events)
      })
    })
  })


  describe("end-to-end", () => {
    it('stores events', async () => {

      const deviceId = Uuid.createV4()
      const alarmId = Uuid.createV4()

      const [device, deviceAggregate] = await deviceRepoistory.create({ id: deviceId })
      device.addAlarm(alarmId)

      const uncommittedEvents = deviceAggregate.uncommittedChanges()

      const emittedEvents: Array<EntityEvent> = []
      eventStore.registerCallback(async changes => changes.forEach(x => emittedEvents.push(x)))

      const countEvents = await device.save()

      assertThat(countEvents).withMessage('Stored Event count').is(2)
      assertThat(emittedEvents).withMessage('Emitted Events').is(match.array.length(2))
      assertThat(uncommittedEvents).is(emittedEvents)
    })

    it('loads events', async () => {
      const deviceId = Uuid.createV4()
      const alarmId = Uuid.createV4()


      const [device, deviceAggregate] = await deviceRepoistory.create({ id: deviceId })
      device.addAlarm(alarmId)
      const uncommitedEvents = deviceAggregate.uncommittedChanges()
      await device.save()

      // Compare Saved event to loaded make sure they are the same
      const loadedEvents = await eventStore.getEvents(device.id)

      assertThat(loadedEvents).is(match.array.length(2))
      assertThat(uncommitedEvents).is(loadedEvents)
    })

    it('detects concurrency', async () => {
      const deviceId = Uuid.createV4()
      const alarmId = Uuid.createV4()

      const [device, deviceAggregate] = await deviceRepoistory.create({ id: deviceId })
      device.addAlarm(alarmId)
      await device.save()

      const [anotherDevice, anotherDeviceAggregate] = await deviceRepoistory.get(device.id);


      // Make changes to both
      device.addAlarm(Uuid.createV4())
      anotherDevice.addAlarm(Uuid.createV4())

      assertThat(deviceAggregate.changeVersion).withMessage('deviceAggregate version').is(1)
      assertThat(anotherDeviceAggregate.changeVersion).withMessage('anotherDeviceAggregate version').is(1)

      assertThat(deviceAggregate.uncommittedChanges()).withMessage("deviceAggregate one event").is(match.array.length(1))
      assertThat(anotherDeviceAggregate.uncommittedChanges()).withMessage("anotherDeviceAggregate one event").is(match.array.length(1))

      assertThat(deviceAggregate.uncommittedChanges()[0].version).withMessage('UnCommited device').is(2)
      assertThat(anotherDeviceAggregate.uncommittedChanges()[0].version).withMessage('UnCommited anotherDevice').is(2)

      assertThat(deviceAggregate.uncommittedChanges()[0].event.aggregateRootId).withMessage('UnCommited device').is(deviceId)
      assertThat(anotherDeviceAggregate.uncommittedChanges()[0].event.aggregateRootId).withMessage('UnCommited anotherDevice').is(deviceId)

      await device.save()
      await anotherDevice.save().then(
        () => {
          throw new Error('Expected and Optimistic concurrency error here!!')
        },
        e => assertThat(e.message).is(`Optimistic concurrency error for aggregate root id: ${deviceId}, version: 2`)
      )
    })
  })
})


