import { ReadModelRepository, Uuid } from "@hyprnz/es-domain";
import { assertThat, match } from "mismatched";
import { AlarmCreatedEvent } from "../../testAggregate/Device";
import { AlarmProjection, ALARM_PROJECTION, alarmProjection } from "../../testAggregate/AlarmProjection";
import { DynamoDbReadRepository } from "./DynamoDbReadRepository";
import { DynamoDB } from "aws-sdk";
import { makeAWSDynamoConfig } from "../../fixtures/testEnvironment";
import { makeReadStoreMigrator } from "./readStoreMigrator";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynamoDbInternalEventStoreConfig } from "../..";
import { Migrator } from "../migrate/commonDynamoMigrator";

describe("DynamoDbReadRepository", () => {
  let readModelRepo: ReadModelRepository;
  let migrate: Migrator
  const applyProjectionChanges = alarmProjection;

  beforeAll(async () => {
    const tableName = 'projection'
    const clientOptions = makeAWSDynamoConfig()
    const db = new DynamoDB(clientOptions)

    migrate = makeReadStoreMigrator(db, tableName, console)
    await migrate.down()
    await migrate.up()

    const config: DynamoDbInternalEventStoreConfig = {
      tableName: tableName,
      clock: () => new Date(),
      uuid: () => Uuid.createV4()
    }

    const docClientOptions: DocumentClient.DocumentClientOptions & DynamoDB.Types.ClientConfiguration = {
      ...clientOptions
    }

    const client = new DynamoDB.DocumentClient(docClientOptions)
    readModelRepo = new  DynamoDbReadRepository(config, client, console)
  });

  afterAll(async () => {
    console.log("Tear Down...")
    await migrate.down()
  })

  it("persists and retrieves projections", async () => {
    // ARRANGE
    // Prepare a loan application projection.
    const deviceId = Uuid.createV4()
    const alarmId = Uuid.createV4()
    const alarmCreatedEvent = AlarmCreatedEvent.make(() => alarmId, {alarmId, deviceId, name: 'Important Alarm'});


    // ACT
    await applyProjectionChanges(
      [{ version: 0, event: alarmCreatedEvent }],
      readModelRepo
    );

    // ASSERT
    // Retrieve the projection that we just persisted.
    const persistedProjection = await readModelRepo.find<AlarmProjection>(
      ALARM_PROJECTION,
      alarmId
    );


    // Retrieved projection should be same as the one we persisted.
    assertThat(persistedProjection).is(
      match.obj.has({
        id: alarmId,
        version: 0,
        name: 'Important Alarm'
      })
    );
  });

  it("can update existing projections", async () => {
    // ARRANGE
    const deviceId = Uuid.createV4()
    const alarmId = Uuid.createV4()
    const alarmCreatedEvent = AlarmCreatedEvent.make(() => alarmId, {alarmId, deviceId, name: 'Important Alarm'});

    await applyProjectionChanges(
      [{ version: 0, event: alarmCreatedEvent }],
      readModelRepo
    );

    // ACT
    const anotherAlarmCreatedEvent = AlarmCreatedEvent.make(() => alarmId, {alarmId, deviceId, name: 'Active Alarm'});
    await applyProjectionChanges([{ version: 1, event: anotherAlarmCreatedEvent }], readModelRepo);

    const updatedProjection = await readModelRepo.find<AlarmProjection>(
      ALARM_PROJECTION,
      alarmId
    );

    // ASSERT
    // We know if the update worked if there is now an extra property of `approvedAmount` present on the projection.
    assertThat(updatedProjection).is(
      match.obj.has({
        id: alarmId,
        version: 1,
        name: 'Active Alarm'
      })
    );
  });

  it("can delete projections", async () => {
    // ARRANGE
    // Create an example projection to delete.
    const deviceId = Uuid.createV4()
    const alarmId = Uuid.createV4()
    const alarmCreatedEvent = AlarmCreatedEvent.make(() => alarmId, {alarmId, deviceId, name: 'Important Alarm'});

    await applyProjectionChanges(
      [{ version: 0, event: alarmCreatedEvent }],
      readModelRepo
    );

    // Get it from the repo (required in order to delete it).
    const savedProjection = await readModelRepo.find<AlarmProjection>(
      ALARM_PROJECTION,
      alarmId
    );
    assertThat(savedProjection).is(match.obj.has({ id: alarmId }));

    // ACT
    // Delete the projection (NB: above assertion will error if `savedProjection` is undefined)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await readModelRepo.delete(ALARM_PROJECTION, savedProjection!);

    // ASSERT
    // Shouldn't be able to find this projection again in the DB.
    const deletedProjection = await readModelRepo.find<AlarmProjection>(
      ALARM_PROJECTION,
      deviceId
    );
    assertThat(deletedProjection).is(undefined);
  });

});
