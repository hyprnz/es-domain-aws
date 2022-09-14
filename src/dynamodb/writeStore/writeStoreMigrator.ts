import { AWSError, DynamoDB } from 'aws-sdk'

export const makeWriteStoreMigrator = (client: DynamoDB, tableName: string = 'eventstore') => {

  const params: DynamoDB.Types.CreateTableInput = {
    TableName: tableName,
    KeySchema: [
      {
        AttributeName: "PK",
        KeyType: "HASH", //Partition key
      },
      {
        AttributeName: "SK",
        KeyType: "RANGE", //Sort key
      },
    ],
    AttributeDefinitions: [
      {
        AttributeName: "PK",
        AttributeType: "S",
      },
      {
        AttributeName: "SK",
        AttributeType: "N",
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
  }

  async function up(): Promise<void> {
    // logger.debug("### Migrating... ###");
    try {


      const exists = (await client.listTables().promise()).TableNames!.includes(tableName)
      if (!exists) {
        await client.createTable(params).promise()
      }
      // logger.debug("### Migration complete! ###");
    } catch (e) {
      // logger.error(new NestedError("There was an error creating the DB:", e));
      console.error('Failed to create DrnamoDb Table', tableName, e)
      throw e
    }
  }

  async function down(): Promise<void> {
    // logger.debug("### Deleting DB... ###");
    try {
      await (client.deleteTable({ TableName: tableName }).promise())
    } catch (e) {

      console.error('There was an error deleting the DB')
      if(isAWSError(e)){
        if(e.code === 'ResourceNotFoundException') return

      }
    }
  }

  return { up, down }
}

function isAWSError(e: unknown) : e is AWSError {
  const maybeAWSError = e as Partial<AWSError>
  return !!(maybeAWSError.code && maybeAWSError.message)
}