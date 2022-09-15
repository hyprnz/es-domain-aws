import { DynamoDB } from "aws-sdk";
import { bool } from "aws-sdk/clients/signer";

export function isInsideContainer<T>(): bool {
    const yes = Boolean(process.env.IS_INSIDE_CONTAINER ?? false)

    console.log(yes ? "Inside contaner" : "Outside container")
    return yes
}

export function whenInsideContainer<T>(yes: T, no:T): T {
    return isInsideContainer() ? yes : no
}

export function makeAWSDynamoConfig(AWS_REGION: string = "ap-southeast-2"): DynamoDB.ClientConfiguration {
    return {
      endpoint: isInsideContainer() ? "http://localstack:4566" : "http://localhost:4566",
      region: AWS_REGION,
      credentials: {
        accessKeyId: "AWS_ACCESS_KEY_ID",
        secretAccessKey: "AWS_SECRET_KEY",
      }
    }
  }