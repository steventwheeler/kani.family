'use strict'

import Algorand from "./algorand.js";
import Graph from "./graph.js";
import ARC19 from "./arc19.js";
import * as IPFS from "ipfs-core";
const toBuffer = require('it-to-buffer');

const creatorAddress = "KANIGZX2NQKJKYJ425BWYKCT5EUHSPBRLXEJLIT2JHGTWOJ2MLYCNIVHFI";
const ownedAssets = [];
const algorandClient = new Algorand();

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
  return Promise.all([algorandClient.getAssets(creatorAddress), algorandClient.getAssetConfigTransactions(creatorAddress), ipfsPromise])
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
        if (asset.params.url.startsWith("template-ipfs://")) {
          var cid = ARC19.parseCID(asset.params.url, asset.params.reserve).toString();
          return toBuffer(ipfs.cat(cid))
            .then(contents => {
              var json = new TextDecoder("utf-8")
                .decode(contents);
              var metadata = JSON.parse(json);
              return metadataToNode(id, asset, metadata);
            });
        } else {
          var tx = transactions.findLast(tx => tx.hasOwnProperty("note") && id == String(tx["created-asset-index"] || tx["asset-config-transaction"]["asset-id"]));
          var metadata = JSON.parse(window.atob(tx.note));
          return metadataToNode(id, asset, metadata);
        }
      }))
    })
    .then(nodes => {
      // Sort the nodes by the unit-name.
      nodes.sort((a, b) => a["asset"]["params"]["unit-name"].toLowerCase().localeCompare(b["asset"]["params"]["unit-name"].toLowerCase()));
      return nodes;
    });
}
