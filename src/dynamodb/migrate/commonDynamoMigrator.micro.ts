import { Thespian, TMocked } from "thespian"
import { AWSError, DynamoDB, Request } from 'aws-sdk'
import { commonDynamoMigrator, InternalMigrator } from "./commonDynamoMigrator"
import { DescribeTableOutput, TableStatus } from "aws-sdk/clients/dynamodb"
import { assertThat } from "mismatched"

describe("commonDynamoMigrator", () => {
    let mocks: Thespian

    beforeEach(() => {
        mocks = new Thespian()
    })

    afterEach(() => mocks.verify())

    describe("waitForDynamoTableReady", () => {
        const tableName = "some-table"
        let dynamoMock: TMocked<DynamoDB>
        let dynamoSetup: InternalMigrator
        beforeEach(() => {
            dynamoMock = mocks.mock<DynamoDB>("dynamo")
            dynamoSetup = commonDynamoMigrator(dynamoMock.object, {} as any, console)
        })

        it("Waits For Table Active", async () => {


            const makeResponse = (status: TableStatus) => ({
                Table: {
                    TableStatus: status,
                },
            })

            dynamoMock
                .setup((x) => x.describeTable({ TableName: tableName }))
                .returns(() => {
                    const response = {
                        promise: () => Promise.resolve(makeResponse("CREATING")),
                    }
                    return response as unknown as Request<DescribeTableOutput, AWSError>
                })
                .times(2)

            dynamoMock
                .setup((x) => x.describeTable({ TableName: tableName }))
                .returns(() => {
                    const response = {
                        promise: () => Promise.resolve(makeResponse("ACTIVE")),
                    }
                    return response as unknown as Request<DescribeTableOutput, AWSError>
                })

            const status = await dynamoSetup.waitForDynamoTableStatus(tableName, 2000, (s) => s === "ACTIVE", 500)
            assertThat(status).is("ACTIVE")
        })

        it("Timeout when table not Active", async () => {
            const makeResponse = (status: TableStatus) => ({
                Table: {
                    TableStatus: status,
                },
            })

            dynamoMock
                .setup((x) => x.describeTable({ TableName: tableName }))
                .returns(() => {
                    const response = {
                        promise: () => Promise.resolve(makeResponse("CREATING")),
                    }
                    return response as unknown as Request<DescribeTableOutput, AWSError>
                })
                .timesAtLeast(1)

            await assertThat(dynamoSetup.waitForDynamoTableStatus(tableName, 2000, (s) => s === "ACTIVE", 500))
                .catches(new Error("Timeout Wait For Dynamo Table(some-table)-CREATING"))
        })
    })
})