import { Logger } from "@hyprnz/es-domain"
import { DynamoDB } from "aws-sdk"
import { commonDynamoMigrator, Migrator } from "../migrate/commonDynamoMigrator"

export function makeReadStoreMigrator(client: DynamoDB, tableName: string = 'projection', logger:Logger = console): Migrator {

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
                AttributeType: "S",
            },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
        },
    }

    return commonDynamoMigrator(client, tableShape, logger)
}

