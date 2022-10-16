import { DynamoDB } from "aws-sdk"
import { assertThat, match } from "mismatched"
import { makeAWSDynamoConfig } from "../../fixtures/testEnvironment"
import { makeWriteStoreMigrator } from "./writeStoreMigrator"

describe('writeStoreMigrator', () => {
    let client: DynamoDB

    beforeAll(async () => {
      const clientOptions  = makeAWSDynamoConfig()
      client = new DynamoDB(clientOptions)
    })
    it('up', async () => {
        const tableName = `some-test-table-${Date.now()}`
        const migrator = makeWriteStoreMigrator(client, tableName)

        await migrator.up()
        const tableNames = (await client.listTables().promise()).TableNames ?? []

        const tableState = await client.describeTable({TableName:tableName}).promise()
        assertThat(tableState.Table?.TableStatus).is("ACTIVE")
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

        const tablesAfterDown = (await client.listTables().promise()).TableNames ?? []
        assertThat(tablesBeforeDown).is(match.array.contains(tableName))
        assertThat(tablesAfterDown).isNot(match.array.contains(tableName))
    })


    function delay(timeout:number): Promise<void> {
        return  new Promise<void>((resolve, reject) => setTimeout(() => resolve(), timeout))
    }
})