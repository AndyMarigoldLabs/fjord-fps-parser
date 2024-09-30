import { ethers } from "ethers";
import * as path from "path";
import { createObjectCsvWriter } from "csv-writer";

const eventSig =
  "event BuyFixedShares(address indexed recipient, uint256 sharesOut, uint256 assetsIn)";

const address = "0xD5430D6cfF45E1319CAC204F2a4e51E2cA3213B1";
const startBlock = 20804136;
const endBlock = 20846133;

const alchemyKey = process.env.RPC;

const provider = new ethers.JsonRpcProvider(alchemyKey);

const contract = new ethers.Contract(address, [eventSig], provider);

async function fetchEvents() {
  const filter = contract.filters.BuyFixedShares();
  const events = await contract.queryFilter(filter, startBlock, endBlock);
  return events;
}

function aggregateData(events: ethers.EventLog[]) {
  const aggregatedData: {
    [key: string]: {
      sharesOut: bigint;
      assetsIn: bigint;
    };
  } = {};
  for (const event of events) {
    const { recipient, sharesOut, assetsIn } = event.args as unknown as {
      recipient: string;
      sharesOut: bigint;
      assetsIn: bigint;
    };
    if (!aggregatedData[recipient]) {
      aggregatedData[recipient] = {
        sharesOut: 0n,
        assetsIn: 0n,
      };
    }
    aggregatedData[recipient].sharesOut =
      aggregatedData[recipient].sharesOut + sharesOut;
    aggregatedData[recipient].assetsIn =
      aggregatedData[recipient].assetsIn + assetsIn;
  }
  return aggregatedData;
}

async function main() {
  try {
    console.log("Fetching events...");
    const events = await fetchEvents();
    console.log(`Found ${events.length} events`);
    console.log("Aggregating data...");
    const aggregatedData = aggregateData(events as ethers.EventLog[]);

    const csvWriter = createObjectCsvWriter({
      path: path.resolve(__dirname, "buyFixedShares.csv"),
      header: [
        { id: "recipient", title: "Recipient" },
        { id: "sharesOut", title: "Total Shares Out" },
        { id: "assetsIn", title: "Total Assets In" },
      ],
    });

    const records = Object.entries(aggregatedData).map(([recipient, data]) => ({
      recipient,
      sharesOut: ethers.formatUnits(data.sharesOut, 18),
      assetsIn: ethers.formatUnits(data.assetsIn, 18),
    }));

    await csvWriter.writeRecords(records);
    console.log("CSV file has been written successfully");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

if (alchemyKey) {
  main();
} else {
  console.error("Alchemy key is not set");
  process.exit(1);
}
