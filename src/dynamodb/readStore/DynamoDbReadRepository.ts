import { Projection, ReadModelRepository, Uuid } from "@hyprnz/es-domain";
import { AWSError } from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynamoDbInternalEventStoreConfig, Logger } from "../..";
import { isAWSError } from "../migrate/commonDynamoMigrator";


export type ProjectionMiddleware = (projectionName: string, projection: Projection) => Promise<Projection>

const PROJECTION = "PROJECTION";
// Allow us to create, update and read back out our projections.
export class DynamoDbReadRepository implements ReadModelRepository {
  constructor(
    private config: DynamoDbInternalEventStoreConfig,
    private dynamoClient: DocumentClient,
    private logger: Logger,
    private readonly middleware: ProjectionMiddleware = (n, p) => Promise.resolve(p as Projection)
  ) {
    if (!dynamoClient) throw new Error("DynamoDb dynamoClient is required")
  }

  // Get a projection, given it's type, and based on it's ID.
  async find<T extends Projection>(projectionName: string, id: Uuid.UUID): Promise<T | undefined> {
    try {
      this.logger.debug("Find", projectionName, id)
      const result = await this.dynamoClient.get({
        TableName: this.config.tableName,
        Key: {
          PK: projectionName,
          SK: this.makeRowId(projectionName, { id: id }),
        }
      }).promise()


      return result.Item
        ? this.fromPersistable<T>(projectionName, result.Item)
        : undefined
    }
    catch(e){
      this.logger.error("Find Error", e)
      const awsError = e as Partial<AWSError>
      if(awsError?.code  === "NotFound") return undefined
      throw e
    }
  }

  // Allows us to save a new projection to the database.
  async create<T extends Projection>(projectionName: string, state: T): Promise<void> {
    const clock = this.config.clock().toISOString()
    this.logger.debug("Create", projectionName, state.id)
    try{
      const result = await this.dynamoClient.put({
        TableName: this.config.tableName,
        Item: this.toPersistable(clock, projectionName, state),
        ConditionExpression: "attribute_not_exists(PK)"
      }).promise()
    }
    catch(e){
      if(isAWSError(e)){
        this.logger.error("Create Error", e.code, e.message)
      } else {
      this.logger.error("Create Error", e)
      }
      throw e
    }
  }


  // Replace a project in-place. Safe to do this as append-only store only valid for read model.
  // E.g. user changes their phone number, and we want the projection to represent this state change.
  async update<T extends Projection>(projectionName: string, state: T): Promise<void> {
    this.logger.debug("Update", projectionName, state.id)
    try
    {
      const response = await this.dynamoClient.update({
        TableName: this.config.tableName,
        Key: {
        PK: projectionName,
        SK: this.makeRowId(projectionName, state),
        },
        AttributeUpdates: {
          PROJECTION: {
            Action: "PUT",
            Value: JSON.stringify(state)
          }
        },
      }).promise()
    }
    catch(e){
      this.logger.error("Update Error", e)
      const awsError = e as Partial<AWSError>
      throw new Error(`Failed to update projection Row, Error:${awsError.code} StatusCode:${awsError.statusCode}`);
    }
  }

  // Remove a projection (e.g. removing an invalid mailing address).
  async delete<T extends Projection>(projectionName: string, state: T): Promise<void> {
    this.logger.debug("Delete", projectionName, state.id)
    await this.dynamoClient.delete({
      TableName: this.config.tableName,
      Key: {
        PK: projectionName,
        SK: this.makeRowId(projectionName, state),
      },
    }).promise()
  }



  // We want to transform our projection object into something that the DB can store (e.g. JSON)
  private toPersistable<T extends Projection>(clock: string, projectionName: string, state: T) {
    return {
      PK: projectionName,
      SK: this.makeRowId(projectionName, state),
      DOMAINTYPE: projectionName,
      CREATED: clock,
      PROJECTION: JSON.stringify(state),
    }
  }

  /** Transform the DB-stored JSON data into our projection object. */
  private fromPersistable<T extends Projection>(projectionName: string, serialised: Record<string, any>): Promise<T | undefined> {
    const projection = serialised ? JSON.parse(serialised[PROJECTION]) : undefined;
    if (isProjection(projection)) {
      return this.middleware(projectionName, projection).then(p => p as T)
    }

    return Promise.resolve(undefined);
  }

  private makeRowId(projectionName: string, state: { id: Uuid.UUID }) {
    return state.id + ":" + projectionName;
  }
}

// TODO - Move this next to the definition of Projection (in `es-domain` package).
function isProjection(maybeProjection: unknown): maybeProjection is Projection {
  const projection = maybeProjection as Partial<Projection>
  const isProjection = !!(projection && projection.id && !isNaN(projection?.version ?? NaN));

  return isProjection
}