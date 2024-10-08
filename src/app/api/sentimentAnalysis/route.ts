// src/app/api/sentimentAnalysis/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  DetectSentimentCommand,
  LanguageCode,
} from "@aws-sdk/client-comprehend";
import { comprehendClient } from "../../../../awsConfig";

// Initialize the DynamoDB client
const dynamoDBClient = new DynamoDBClient({
  region: "ap-northeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Initialize the DynamoDB Document Client
const documentClient = DynamoDBDocumentClient.from(dynamoDBClient);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const PK = searchParams.get("PK");
  const SK = searchParams.get("SK");

  // Debugging log
  console.log("Received PK:", PK);
  console.log("Received SK:", SK);

  if (!PK || !SK) {
    return NextResponse.json(
      { error: "PK and SK must be provided" },
      { status: 400 }
    );
  }

  try {
    // Retrieve data from DynamoDB using the DynamoDB Document Client
    const getParams = {
      TableName: "PamVoiceAgent",
      Key: {
        PK,
        SK,
      },
    };

    interface DynamoDBGetItemOutput {
      Item?: {
        Feedback: string;
      };
    }

    const data = (await documentClient.send(
      new GetCommand(getParams)
    )) as DynamoDBGetItemOutput;

    if (!data.Item || !data.Item.Feedback) {
      return NextResponse.json(
        { error: "No data found or Feedback missing" },
        { status: 404 }
      );
    }

    const textToAnalyze = data.Item.Feedback;

    // Perform sentiment analysis using AWS Comprehend
    const comprehendParams = {
      Text: textToAnalyze,
      LanguageCode: "en" as LanguageCode, // Assuming the feedback is in English
    };

    const sentimentData = await comprehendClient.send(
      new DetectSentimentCommand(comprehendParams)
    );

    return NextResponse.json(
      {
        message: "Sentiment analysis completed successfully",
        sentiment: sentimentData.Sentiment,
        sentimentScore: sentimentData.SentimentScore,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
