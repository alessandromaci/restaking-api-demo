import { signAndBroadcast } from "./sign.js";
import axios from "axios";
import { readFileSync } from "fs";

// Constants
const config = JSON.parse(readFileSync("./config.json", "utf-8"));
const API_BASE_URL = config.url;
const AUTH_TOKEN = config.token;
const STAKER_ADDRESS = config.stakerAddress;
const VALIDATOR_PUB_KEY =
  "0x800934f77ed347994543783357b7ac27c98dd12d71c19c170830b3290fedd750266637854f8d3547bc23fa03fa9d2485";
const OPERATOR_ADDRESS = "0x37d5077434723d0ec21d894a52567cbe6fb2c3d8";

// Authorization headers helper
function getAuthorizationHeaders() {
  return {
    accept: "application/json",
    authorization: AUTH_TOKEN,
    "content-type": "application/json",
  };
}

async function checkValidatorStatus(pubKey) {
  const url = `${API_BASE_URL}eth/staking/direct/validator/status`;
  const data = { pubkeys: [pubKey] };

  try {
    const response = await axios.post(url, data, {
      headers: getAuthorizationHeaders(),
    });
    const validatorStatus = response.data.result.list[0]?.status;
    console.log(`Validator Status: ${validatorStatus}`);

    if (validatorStatus !== "active_ongoing") {
      throw new Error("Validator is not yet active.");
    }
  } catch (error) {
    console.error(
      "Error checking validator status:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function createActivateRestakeRequest(pubKey) {
  const url = `${API_BASE_URL}eth/staking/eigenlayer/tx/verify-withdrawal-credentials`;
  const data = {
    eigenPodOwnerAddress: STAKER_ADDRESS,
    pubkey: pubKey,
  };
  try {
    const response = await axios.post(url, data, {
      headers: getAuthorizationHeaders(),
    });
    console.log("Restake Request Response:", response.data);
    return response.data.result;
  } catch (error) {
    console.error(
      "Error initiating restake request:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

async function createDelegateOperatorTx(operatorAddress) {
  const url = `${API_BASE_URL}eth/staking/eigenlayer/tx/delegate-to`;
  const data = {
    operatorAddress: operatorAddress,
  };
  try {
    const response = await axios.post(url, data, {
      headers: getAuthorizationHeaders(),
    });
    console.log("Delegate Request Response:", response.data);
    return response.data.result;
  } catch (error) {
    console.error(
      "Error initiating delegate request:",
      error.response?.data || error.message
    );
    throw error;
  }
}

(async function main() {
  try {
    console.log("Starting restaking process...");

    if (global.hasRun) {
      console.log("Main function already executed. Exiting...");
      return;
    }
    global.hasRun = true;

    console.log("Step 1: Checking if Validator is Active...");
    await checkValidatorStatus(VALIDATOR_PUB_KEY);
    console.log("Validator is active. Proceeding with restaking process...");

    console.log("Step 2: Activating Restake Request...");
    const restakeActivation = await createActivateRestakeRequest(
      VALIDATOR_PUB_KEY
    );
    console.log("Restake Activated:", restakeActivation);

    console.log("Step 3: Delegating to Operator...");
    const delegateResponse = await createDelegateOperatorTx(OPERATOR_ADDRESS);
    console.log("Delegation Transaction Response:", delegateResponse);

    console.log("Signing and Broadcasting Delegation Transaction...");
    const signedDelegateTx = await signAndBroadcast(
      delegateResponse.serializeTx,
      delegateResponse.gasLimit,
      delegateResponse.maxFeePerGas,
      delegateResponse.maxPriorityFeePerGas,
      delegateResponse.value
    );
    console.log("Delegation Transaction Broadcasted:", signedDelegateTx.hash);
  } catch (error) {
    console.error("Restaking process failed:", error.message);
  }
})();
