'use strict'

import toBuffer from 'it-to-buffer';
import axios from 'axios';
import Algorand from "./algorand.js";
import Graph from "./graph.js";
import ARC19 from "./arc19.js";

const creatorAddress = "KANIGZX2NQKJKYJ425BWYKCT5EUHSPBRLXEJLIT2JHGTWOJ2MLYCNIVHFI";
const ownedAssets = [];
const algorandClient = new Algorand();
const cloudflareUrl = 'https://cloudflare-ipfs.com';
const arguteUrl = 'https://ipfs.argute.io';

function httpGetIPFSResource(baseUrl, cid) {
  return axios.get(`${baseUrl}/ipfs/${cid}`)
    .then(response => response.data);
}

function resolveIPFS(cid, ipfsClient) {
  console.log(`Loading ${cid} from IPFS...`)
  return toBuffer(ipfsClient.cat(cid, { timeout: 1_000 }))
    .then(contents => new TextDecoder("utf-8").decode(contents))
    .then(text => JSON.parse(text))
    .catch(ipfsError => {
      console.log(`WARN: Failed to load ${cid} via IPFS, falling back to ${arguteUrl}.`);
      return httpGetIPFSResource(arguteUrl, cid)
        .catch(arguteError => {
          console.log(`WARN: Failed to load ${cid} via ${arguteUrl}, falling back to ${cloudflareUrl}.`);
          return httpGetIPFSResource(cloudflareUrl, cid)
            .catch(cloudflareError => {
              console.log(`Failed to load data for ${cid}!`)
              console.log("IPFS Error:")
              console.log(ipfsError);
              console.log("Argute Error:")
              console.log(arguteError);
              console.log("Cloudflare Error:")
              console.log(cloudflareError);

              throw `Unable to load ${cid} from IPFS or a public HTTP gateway.`
            });
        });
    });
}

function parseName(description) {
  if (!description) {
    return "";
  } else if (/^\s*Kani World -\s+Kani[ -][0-9]+$/.test(description)) {
    return description.replace(/^\s*Kani World -\s*/i, "");
  } else {
    return description.replace(/^\s*Kani World - (Kani )?/i, "");
  }
}

function metadataToNode(id, asset, metadata) {
  return {
    id: id,
    children: [],
    asset: asset,
    metadata: metadata,
    name: parseName(metadata.description),
  };
}

export default function loadKani(ipfsPromise) {
  console.log("Loading assets created by " + creatorAddress + "...");
  const assetsPromise = algorandClient.getAssets(creatorAddress)
    .then(assets => {
      console.log("Loaded " + assets.length + " asset(s).");
      return assets;
    });

  console.log("Loading asset config transactions...")
  const transactionsPromise = algorandClient.getAssetConfigTransactions(creatorAddress)
    .then(transactions => {
      console.log("Loaded " + transactions.length + " transaction(s).");
      return transactions;
    });

  console.log("Connecting to IPFS...");
  ipfsPromise = ipfsPromise.then(ipfs => {
    console.log("Connected to IPFS.");
    return ipfs;
  });

  return Promise.all([assetsPromise, transactionsPromise, ipfsPromise])
    .then(values => {
      var assets = values[0];
      var transactions = values[1];
      var ipfs = values[2];

      // Ensure that the list of transactions is sorted by the confirmed round
      // time.
      transactions.sort((a, b) => a["confirmed-round"] - b["confirmed-round"]);

      // Collect the data for each asset.
      return Promise.all(assets.map(asset => {
        var id = String(asset.index);
        var name = asset["params"]["unit-name"];
        if (asset.params.url.startsWith("template-ipfs://")) {
          var cid = ARC19.parseCID(asset.params.url, asset.params.reserve).toString();
          console.log(name + " (" + id + ") uses ARC19, loading " + cid + " from IPFS...");
          return resolveIPFS(cid, ipfs)
            .then(json => metadataToNode(id, asset, json))
            .catch(error => {
              console.log("Error loading metadata for " + name + " (" + id + ")! IPFS CID: " + cid);
              console.log(error);
            });
        } else {
          var tx = transactions.findLast(tx => tx.hasOwnProperty("note") && id == String(tx["created-asset-index"] || tx["asset-config-transaction"]["asset-id"]));
          var metadata = JSON.parse(window.atob(tx.note));
          return metadataToNode(id, asset, metadata);
        }
      }))
    })
    .then(nodes => nodes.filter(e => e !== undefined))
    .then(nodes => {
      // Sort the nodes by the unit-name.
      nodes.sort((a, b) => a["asset"]["params"]["unit-name"].toLowerCase().localeCompare(b["asset"]["params"]["unit-name"].toLowerCase()));
      return nodes;
    })
    .then(nodes => {
      console.log("Loaded " + nodes.length + " kani assets.");
      return nodes;
    });
}
