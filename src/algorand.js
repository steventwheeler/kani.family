'use strict'

const algosdk = require('algosdk');

class Algorand {
  constructor() {
    this.indexerClient = new algosdk.Indexer("", "https://algoindexer.algoexplorerapi.io", 443);
  }

  getAssets(creator) {
    const indexerClient = this.indexerClient;
    const execute = function(page) {
      return new Promise((resolve, reject) => {
        indexerClient.lookupAccountCreatedAssets(creator)
          .nextToken(page)
          .do()
          .then(response => {
            if (response["next-token"] === undefined) {
              // This was the last page.
              resolve(response.assets);
            } else {
              // Load the next page.
              execute(response["next-token"])
                .then(assets => resolve([...assets, ...response.assets]))
                .catch(error => reject(error));
            }
          })
          .catch(error => reject(error));
      });
    }
    return execute();
  }

  getAssetConfigTransactions(creator) {
    const indexerClient = this.indexerClient;
    const execute = function(page) {
      return new Promise((resolve, reject) => {
        indexerClient.searchForTransactions()
          .address(creator)
          .addressRole("sender")
          .txType("acfg")
          .nextToken(page)
          .do()
          .then(response => {
            if (response["next-token"] === undefined) {
              // This was the last page.
              resolve(response.transactions);
            } else {
              // Load the next page.
              execute(response["next-token"])
                .then(transactions => resolve([...transactions, ...response.transactions]))
                .catch(error => reject(error));
            }
          })
          .catch(error => reject(error));
      });
    }
    return execute();
  }

  getAccountAssets(account) {
    const indexerClient = this.indexerClient;
    const execute = function(page) {
      return new Promise((resolve, reject) => {
        indexerClient.lookupAccountAssets(account)
          .nextToken(page)
          .do()
          .then(response => {
            if (response["next-token"] === undefined) {
              // This was the last page.
              resolve(response.assets);
            } else {
              // Load the next page.
              execute(response["next-token"])
                .then(assets => resolve([...assets, ...response.assets]))
                .catch(error => reject(error));
            }
          })
          .catch(error => reject(error));
      });
    }
    return execute();
  }
}

module.exports = Algorand;
