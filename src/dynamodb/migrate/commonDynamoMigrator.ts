import { Logger } from '@hyprnz/es-domain'
import { AWSError, DynamoDB } from 'aws-sdk'
import { TableStatus } from 'aws-sdk/clients/dynamodb'

export interface Migrator {
  up(): Promise<void>,
  down(): Promise<void>
}

export type InternalMigrator = Migrator & {waitForDynamoTableStatus: (
  tableName: string,
  timeoutMs: number,
  statusPredicate: (status: string | undefined) => boolean,
  intervalMs: number
) => Promise<TableStatus | undefined>}

export const commonDynamoMigrator = (client: DynamoDB, tableDefinition: DynamoDB.Types.CreateTableInput, logger: Logger) : InternalMigrator  => {

  async function up(): Promise<void> {
    logger.debug("### Migrating UP... ###");
    try {
      const {TableName} = tableDefinition
      const initalStatus = await waitForDynamoTableStatus(
        TableName,
        2000,
        // Wait for either active or removed
        (s) => (s === undefined || s === "ACTIVE"),
        500
      )

      if (!initalStatus) {
        logger.debug(`Table creating: ${TableName}`)
        await client.createTable(tableDefinition).promise()
        const status = await waitForDynamoTableStatus(
          TableName,
          1000,
          // Wait for active
          (s) => s === "ACTIVE",
          300
        )
        logger.debug(`Table created:${TableName} - ${status}`)
      } else {
        logger.debug(`### Migration complete! ${TableName} - ${initalStatus} ###`);
      }
      logger.debug(`### Migration complete! ${TableName} - ${initalStatus} ###`);
    } catch (e) {
      if(isAWSError(e)){
        // Table already created
        if(e.code === 'ResourceInUseException') return
      }

      logger.error(`Failed to create DynamoDb Table ${tableDefinition.TableName}`, e)
      throw e
    }
  }



  async function down(): Promise<void> {
    // logger.debug("### Deleting DB... ###");
    try {
      const {TableName} = tableDefinition
      const initalStatus = await waitForDynamoTableStatus(
        TableName,
        2000,
        // Wait for either active or removed
        (s) => (s === undefined || s === "ACTIVE"),
        200
      )
      if(initalStatus) {
        logger.debug(`Table deleteing:${TableName} Status: ${initalStatus}`)
        await client.deleteTable({ TableName: TableName }).promise()
        const status = await waitForDynamoTableStatus(
          TableName,
          2000,
          // Wait for active
          (s) => s === undefined,
          200
        )
        logger.debug(`Table deleted:${TableName} Status: ${initalStatus}`)
      }
    } catch (e) {
      if(isAWSError(e)){
        // Table has gone so dont raise an error...
        if(e.code === "ResourceNotFoundException") return
      }

      // logger.error('There was an error deleting the DB', e)
      throw e
    }
  }


  async function waitForDynamoTableStatus(
    tableName: string,
    timeoutMs: number,
    statusPredicate: (status: string | undefined) => boolean,
    intervalMs: number
  ): Promise<TableStatus | undefined> {
    const pollTable = async (): Promise<TableStatus | undefined> => {
      try {
        const tableState = await client.describeTable({ TableName: tableName }).promise()
        return tableState.Table?.TableStatus
      } catch (e) {
        if( isAWSError(e)){
        // const awsError = e as aws.AWSError
        if (e.code === "ResourceNotFoundException") return undefined
        }
        throw e
      }
    }

    return new Promise<TableStatus | undefined>(async (resolve, reject) => {
      let timeout = timeoutMs
      const interval = setInterval(async () => {
        try {
          const status = await pollTable()
          timeout -= intervalMs
          // console.log(`Status: ${status}, timeoutMs: ${timeoutMs}, Remaining: ${timeout}`)

          if (statusPredicate(status)) {
            clearInterval(interval)
            return resolve(status)
          }

          logger.info(`Table Status: ${status} retrying`)

          if (timeout <= 0) {
            clearInterval(interval)
            const errorMessage = `Timeout Wait For Dynamo Table(${tableName}) Status:${status}`
            logger.error(errorMessage)
            return reject(new Error(errorMessage))
          }
        } catch (e) {
          clearInterval(interval)
          const errorMessage = `Unexpected error Wait For Dynamo Table(${tableName})`
          logger.error(errorMessage)
          return reject(e)
        }
      }, intervalMs)
    })
  }

  return { up, down, waitForDynamoTableStatus }
}

export function isAWSError(e: unknown) : e is AWSError {
  const maybeAWSError = e as Partial<AWSError>
  return !!(maybeAWSError.code && maybeAWSError.message)
}