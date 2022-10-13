import { Logger, WriteModelRepositoryError } from '@hyprnz/es-domain'
import { ChangeEvent, EntityEvent, InternalEventStore, OptimisticConcurrencyError, Uuid } from '@hyprnz/es-domain'
import { AttributeMap, DocumentClient, TransactWriteItem } from 'aws-sdk/clients/dynamodb'
import { isAWSError } from '../migrate/commonDynamoMigrator';


interface DynamoID {
  PK: string,
  SK: number,
}

type EventStoreModel = DynamoID & {
  DOMAINTYPE: string,
  CREATED: string,
  EVENT: string,
}

const sortDynamoObjBySK = (a: AttributeMap, b: AttributeMap) => a.SK > b.SK ? 1 : -1;


export interface DynamoDbInternalEventStoreConfig {
  tableName: string,
  clock: () => Date,
  uuid: () => string
}

const MAX_BATCH_SIZE = 25;

export class DynamoDbInternalEventStore implements InternalEventStore {
  constructor(
    private config: DynamoDbInternalEventStoreConfig,
    private dynamoClient: DocumentClient,
    private logger: Logger
  ) {
    if (!dynamoClient) throw new Error("DynamoDb dynamoClient is required")
  }

  getEvents(id: Uuid.UUID): Promise<EntityEvent[]> {
    return this.findByPK(id, 0)
      .then(result => result.map(this.fromPersistable))
  }
  getEventsAfterVersion(id: Uuid.UUID, version: number): Promise<EntityEvent[]> {
    // TODO : Do this a bit smarter using dynamo  clause
    return this.findByPK(id, version)
      .then(result => result.map(this.fromPersistable))
      .then(result => result.filter(x => x.version >= version))
  }

  async appendEvents(aggregateId: Uuid.UUID, changeVersion: number, changes: EntityEvent[]): Promise<void> {
    const clock = this.config.clock().toISOString()
    const models = changes.map(x => this.toPersistable(clock, x))
    await this.save(aggregateId, changeVersion, models)
  }




  private async findByPK(id: string, fromVersion: number): Promise<Array<EventStoreModel>> {
    if (!id) throw new Error(`Invalid PK required , ${id}`)

    // this.logger.debug({ PK: id }, "Finding object by pk");
    const dynamoData: DocumentClient.QueryOutput = await this.dynamoClient.query({
      TableName: this.config.tableName,
      KeyConditionExpression: "PK = :partitionKey and SK >= :version",
      ExpressionAttributeValues: { ":partitionKey": id, ":version": fromVersion }
    }).promise();

    if (dynamoData.Count === 0) return [];

    const dynamoItems = dynamoData.Items?.sort(sortDynamoObjBySK) as Array<EventStoreModel>;
    return dynamoItems;
  }

  private async save(aggregateId: Uuid.UUID, changeVersion: number, eventList: Array<EventStoreModel>): Promise<void> {
    if (eventList.length === 0) return
    if (eventList.length > MAX_BATCH_SIZE) {
      throw new Error(`NOT IMPLEMENTED: Event batch of size of ${eventList.length} is larger than MAX_BATCH_SIZE of ${MAX_BATCH_SIZE}`);
    }

    const writeItems = eventList.map<TransactWriteItem>((event) => ({
      Put: {
        TableName: this.config.tableName,
        Item: event as any,
        // Require that no items exists with this pk+sk pair - existence signifies concurrent write
        ConditionExpression: "attribute_not_exists(PK)"
      }
    }))

    try {
      // this.logger.debug("Before Save object", eventList);

      const saveResult = await (this.dynamoClient.transactWrite({
        ClientRequestToken: this.config.uuid(),
        TransactItems: writeItems
      }).promise())

      // this.logger.debug("After Saved object", saveResult);

    } catch (e) {
      if(isAWSError(e)){
        this.logger.error(JSON.stringify(e))
        if (e.code === 'TransactionCanceledException') throw new OptimisticConcurrencyError(aggregateId, changeVersion)
        throw new WriteModelRepositoryError('AggregateRoot', `Dynamo Db Error: ${e.code}`)
      }
      throw e
    }
  }


  private toPersistable(clock: string, change: EntityEvent): EventStoreModel {
    const result: EventStoreModel = {
      PK: change.event.aggregateRootId,
      SK: change.version,
      DOMAINTYPE: change.event.eventType,
      CREATED: clock,
      EVENT: JSON.stringify(change.event)
    }
    return result
  }

  // Maybe these should be injected ?
  private fromPersistable(x: EventStoreModel): EntityEvent {
    const result = {
      version: x.SK,
      event: JSON.parse(x.EVENT) as ChangeEvent
    }

    // this.logger.debug('To EntityEvent', JSON.stringify(result))
    return result
  }
}
