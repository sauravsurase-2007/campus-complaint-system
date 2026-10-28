'use strict';
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const TableName = process.env.TABLE_NAME;
const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

async function createComplaint(item) {
  await doc.send(new PutCommand({ TableName, Item: item, ConditionExpression: 'attribute_not_exists(complaintId)' }));
  return item;
}

async function getComplaint(complaintId) {
  const r = await doc.send(new GetCommand({ TableName, Key: { complaintId } }));
  return r.Item || null;
}

// Students: only items whose userId equals their own Cognito "sub".
async function listByUser(userId) {
  const items = [];
  let key;
  do {
    const r = await doc.send(new QueryCommand({
      TableName,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      ScanIndexForward: false,
      ExclusiveStartKey: key,
    }));
    items.push(...r.Items);
    key = r.LastEvaluatedKey;
  } while (key);
  return items;
}

// Admins: everything (fine for campus scale; switch to a status GSI if the table grows large).
async function listAll(status) {
  const items = [];
  let key;
  do {
    const params = { TableName, ExclusiveStartKey: key };
    if (status) {
      params.FilterExpression = '#s = :s';
      params.ExpressionAttributeNames = { '#s': 'status' };
      params.ExpressionAttributeValues = { ':s': status };
    }
    const r = await doc.send(new ScanCommand(params));
    items.push(...r.Items);
    key = r.LastEvaluatedKey;
  } while (key);
  return items.sort(byNewest);
}

async function updateComplaint(complaintId, { status, adminRemark }, historyEntry) {
  const r = await doc.send(new UpdateCommand({
    TableName,
    Key: { complaintId },
    ConditionExpression: 'attribute_exists(complaintId)',
    UpdateExpression: 'SET #s = :s, adminRemark = :r, updatedAt = :u, history = list_append(if_not_exists(history, :e), :h)',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': status, ':r': adminRemark, ':u': historyEntry.at, ':h': [historyEntry], ':e': [] },
    ReturnValues: 'ALL_NEW',
  }));
  return r.Attributes;
}

module.exports = { createComplaint, getComplaint, listByUser, listAll, updateComplaint };
