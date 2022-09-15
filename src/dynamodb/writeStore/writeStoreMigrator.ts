import { AWSError, DynamoDB } from 'aws-sdk'
import { commonDynamoMigrator } from '../migrate/commonDynamoMigrator'

export const makeWriteStoreMigrator = (client: DynamoDB, tableName: string = 'eventstore') => {

  const tableShape: DynamoDB.Types.CreateTableInput = {
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

  return commonDynamoMigrator(client, tableShape)
}