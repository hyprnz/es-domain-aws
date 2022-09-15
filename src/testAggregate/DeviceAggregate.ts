import { Aggregate, AggregateContainer, ChangeEvent, EntityEvent, Uuid } from '@hyprnz/es-domain'
import { Alarm, Device, DeviceCreatedEvent } from './Device'

// export class DeviceAggregate implements Aggregate {
//   constructor(private aggregate: AggregateContainer<Device> = new AggregateContainer(Device)

//   private get root(): Device {
//     return this.aggregate.rootEntity
//   }

//   get changeVersion(): number {
//     return this.aggregate.changeVersion
//   }

//   get id(): Uuid.UUID {
//     return this.aggregate.id
//   }

//   markChangesAsCommitted(version: number): void {
//     this.aggregate.markChangesAsCommitted(version)
//   }

//   uncommittedChanges(): Array<EntityEvent> {
//     return this.aggregate.uncommittedChanges()
//   }

//   withDevice(id: Uuid.UUID): this {
//     this.root.applyChangeEvent(DeviceCreatedEvent.make(Uuid.createV4, { deviceId: id }))
//     return this
//   }

//   loadFromHistory(history: EntityEvent[]): void {
//     this.aggregate.loadFromHistory(history)
//   }

//   loadFromVersion(changeEvents: ChangeEvent[], version: number): void {
//     this.aggregate.loadFromVersion(changeEvents, version)
//   }

//   addAlarm(alarmId: Uuid.UUID): Alarm {
//     return this.root.addAlarm(alarmId)
//   }

//   destroyAlarm(alarmId: Uuid.UUID): void {
//     const alarm = this.root.findAlarm(alarmId)
//     if (alarm) this.root.destroyAlarm(alarm)
//   }

//   findAlarm(alarmId: Uuid.UUID): Alarm | undefined {
//     return this.root.findAlarm(alarmId)
//   }

//   markSnapshotsAsCommitted(): void {
//     this.aggregate.markSnapshotsAsCommitted()
//   }

//   countOfEvents(): number {
//     return this.aggregate.countOfEvents()
//   }
// }
