import { DynamoDB } from "aws-sdk"
import { assertThat, match } from "mismatched"
import { makeWriteStoreMigrator } from "./writeStoreMigrator"

describe('writeStoreMigrator', () => {
    let client: DynamoDB

    beforeAll(async () => {

        const clientOptions: DynamoDB.Types.ClientConfiguration = {
            // endpoint: "http://localstack:4566",
            endpoint: "http://localhost:4566",
            region: "sa-east-1",
            credentials: {
                accessKeyId: "process.env.AWS_ACCESS_KEY_ID",
                secretAccessKey: "process.env.AWS_SECRET_KEY",
            }
        }

        client = new DynamoDB(clientOptions)
    })
    it('up', async () => {
        const tableName = `some-test-table-${Date.now()}`
        const migrator = makeWriteStoreMigrator(client, tableName)

        await migrator.up()
        const tableNames = (await client.listTables().promise()).TableNames ?? []

        const tableState = await client.describeTable({TableName:tableName}).promise()
        assertThat(tableState.Table?.TableStatus).isAnyOf(["ACTIVE", "CREATING"])
        assertThat(tableNames).is(match.array.contains(tableName))
    })

    it('tableStructure', async () => {
        const tableName = `some-test-table-${Date.now()}`
        const migrator = makeWriteStoreMigrator(client, tableName)

        await migrator.up()
        const tableState = await client.describeTable({TableName:tableName}).promise()
        assertThat(tableState.Table?.AttributeDefinitions).withMessage('AttributeDefinitions').is( [
            {
              AttributeName: "PK",
              AttributeType: "S",
            },
            {
              AttributeName: "SK",
              AttributeType: "N",
            },
          ])

          assertThat(tableState.Table?.KeySchema).withMessage('KeySchema').is( [
            {
              AttributeName: "PK",
              KeyType: "HASH", //Partition key
            },
            {
              AttributeName: "SK",
              KeyType: "RANGE", //Sort key
            },
          ])
    })

    it('down', async () => {
        const tableName = `some-test-table-${Date.now()}`
        const migrator = makeWriteStoreMigrator(client, tableName)

        await migrator.up()
        const tablesBeforeDown = (await client.listTables().promise()).TableNames ?? []


        await migrator.down()
        await delay(100)

        const tablesAfterDown = (await client.listTables().promise()).TableNames ?? []
        assertThat(tablesBeforeDown).is(match.array.contains(tableName))
        assertThat(tablesAfterDown).isNot(match.array.contains(tableName))
    })


    function delay(timeout:number): Promise<void> {
        return  new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 2000))
    }
})