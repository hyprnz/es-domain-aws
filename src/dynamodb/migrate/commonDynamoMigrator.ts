import { AWSError, DynamoDB } from 'aws-sdk'

export interface Migrator {
  up(): Promise<void>,
  down(): Promise<void>
}

export const commonDynamoMigrator = (client: DynamoDB, tableDefinition: DynamoDB.Types.CreateTableInput): Migrator => {

  async function up(): Promise<void> {
    // logger.debug("### Migrating... ###");
    try {
      const exists = await tableExits(tableDefinition.TableName)
      if (!exists) {
        await client.createTable(tableDefinition).promise()
        console.debug("Table added", tableDefinition.TableName)
      }
      // logger.debug("### Migration complete! ###");
    } catch (e) {
      // logger.error(new NestedError("There was an error creating the DB:", e));
      console.error('Failed to create DrnamoDb Table', tableDefinition.TableName, e)
      throw e
    }
  }



  async function down(): Promise<void> {
    // logger.debug("### Deleting DB... ###");
    try {
      const exists = await tableExits(tableDefinition.TableName)
      if(exists) {
        await client.deleteTable({ TableName: tableDefinition.TableName }).promise()
        console.debug("Table removed", tableDefinition.TableName)
      }
    } catch (e) {
      console.error('There was an error deleting the DB', e)
      throw e
    }
  }
  async function tableExits(name:string) {
    const tableList = await client.listTables().promise()
    return (tableList.TableNames ?? []).includes(name)
  }

  return { up, down }
}

export function isAWSError(e: unknown) : e is AWSError {
  const maybeAWSError = e as Partial<AWSError>
  return !!(maybeAWSError.code && maybeAWSError.message)
}