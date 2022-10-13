import { Logger } from '@hyprnz/es-domain'
import { AWSError, DynamoDB } from 'aws-sdk'

export interface Migrator {
  up(): Promise<void>,
  down(): Promise<void>
}

export const commonDynamoMigrator = (client: DynamoDB, tableDefinition: DynamoDB.Types.CreateTableInput, logger: Logger): Migrator => {

  async function up(): Promise<void> {
    // logger.debug("### Migrating... ###");
    try {
      const {TableName} = tableDefinition
      const exists = await tableExits(TableName)
      if (!exists) {
        logger.debug("Table creating", TableName)
        await client.createTable(tableDefinition).promise()
        logger.debug("Table created", TableName)
      }
      // logger.debug("### Migration complete! ###");
    } catch (e) {
      // logger.error(new NestedError("There was an error creating the DB:", e));
      logger.error('Failed to create DynamoDb Table', tableDefinition.TableName, e)
      throw e
    }
  }



  async function down(): Promise<void> {
    // logger.debug("### Deleting DB... ###");
    try {
      const {TableName} = tableDefinition
      const exists = await tableExits(TableName)
      if(exists) {
        logger.debug("Table deleting", TableName)
        await client.deleteTable({ TableName: TableName }).promise()
        logger.debug("Table deleted", TableName)
      }
    } catch (e) {
      if(isAWSError(e)){
        // Table has gone so dont raise an error...
        if(e.code === "ResourceNotFoundException") return
      }

      logger.error('There was an error deleting the DB', e)
      throw e
    }
  }

  async function tableExits(name:string): Promise<boolean> {
    const tableList = await client.listTables().promise()
    return (tableList.TableNames ?? []).includes(name)
  }

  return { up, down }
}

export function isAWSError(e: unknown) : e is AWSError {
  const maybeAWSError = e as Partial<AWSError>
  return !!(maybeAWSError.code && maybeAWSError.message)
}