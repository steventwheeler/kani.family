(function($, document, window) {
  const creatorAddress = "KANIGZX2NQKJKYJ425BWYKCT5EUHSPBRLXEJLIT2JHGTWOJ2MLYCNIVHFI";
  const ownedAssets = [];

  var BrowserText = (function () {
      var canvas = document.createElement("canvas"),
          context = canvas.getContext("2d");

      /**
       * Measures the rendered width of arbitrary text given the font size and font face
       * @param {string} text The text to measure
       * @param {number} fontSize The font size in pixels
       * @param {string} fontFace The font face ("Arial", "Helvetica", etc.)
       * @returns {number} The width of the text
       **/
      function getWidth(text, fontSize, fontFace) {
          context.font = fontSize + "px " + fontFace;
          return context.measureText(text).width;
      }

      return {
          getWidth: getWidth
      };
  })();

  var Algorand = (function () {
    const indexerClient = new algosdk.Indexer("", "https://algoindexer.algoexplorerapi.io", 443);

    function getAssets(creator) {
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

    function getAssetConfigTransactions(creator) {
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

    function getAccountAssets(account) {
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

    return {
      getAssets: getAssets,
      getAssetConfigTransactions: getAssetConfigTransactions,
      getAccountAssets: getAccountAssets,
    }
  })();

  var Graph = (function () {
    var graph = [];
    const self = {
      /**
       * Add a new root node to the graph.
       * @param {object} node The new root node
       */
      addRoot: function (node) {
        graph.push(node);
      },

      /**
       * Retrieve a node from the graph based on the value of its `id`
       * attribute. If no matching node is found then an exception will be
       * thrown.
       * @param {string} id The id of the node to locate
       * @returns {object} The node, if it exists
       */
      findById: function (id) {
        const queue = []
        queue.push(...graph);
        while (queue.length > 0) {
          node = queue.shift();
          if (node.id === id) return node;

          queue.push(...node.children);
        }

        throw "Unknown node: " + id;
      },

      /**
       * Caculate the height of the provided node in the graph.
       * @param {object} node The node to check
       * @returns {number} The height of the node
       **/
      height: function (node) {
        var max = 0;
        for (var i = 0; i < node.children.length; i++) {
          max = Math.max(max, self.height(node.children[i]));
        }
        return max + 1;
      },

      descendants: function (node) {
        if (!node.children) return 0;

        var count = node.children.length;
        for (var i = 0; i < node.children.length; i++) {
          count += self.descendants(node.children[i]);
        }
        return count;
      },
    };
    return self;
  })();

  Promise.all([Algorand.getAssets(creatorAddress), Algorand.getAssetConfigTransactions(creatorAddress)])
    .then(values => {
      var assets = values[0];
      var transactions = values[1];

      // Ensure that the list of transactions is sorted by the confirmed
      // round time.
      transactions.sort((a, b) => a["confirmed-round"] - b["confirmed-round"])

      // Collect the data for each asset.
      var nodes = [];
      assets.forEach((asset, i) => {
        var id = String(asset.index);
        var tx = transactions.findLast(tx => tx.hasOwnProperty("note") && id == String(tx["created-asset-index"] || tx["asset-config-transaction"]["asset-id"]));
        var metadata = JSON.parse(window.atob(tx.note));
        nodes.push({
          id: id,
          children: [],
          asset: asset,
          tx: tx,
          metadata: metadata,
          name: metadata.description.replace(/^\s*Kani World - /i, ""),
          strokeColor: metadata.properties['Mutation'] === 'False' ? null : 'red',
        });
      });

      // Sort the nodes by the id.
      nodes.sort((a, b) => a.id - b.id);

      // Build a graph of each nodes paternity.
      var root = { id: "Original8", name: "Original8", children: [] };
      Graph.addRoot(root);
      nodes.forEach((node, i) => {
        // Skip the queens.
        if (["394248226", "394250676", "394243491", "394251425"].includes(node.id)) return;

        var father = Graph.findById(String(node.metadata.properties["Father"]));
        father.children.push(node);
      });

      // Sort the children in ascending order.
      const queue = [root]
      while (queue.length > 0) {
        node = queue.shift();
        queue.push(...node.children);

        node.children.sort((a, b) => -1 * (Graph.descendants(a) - Graph.descendants(b)));
      }

      // Initialize the tree view.
      var height = Graph.height(root);
      var diameter = height * 250;

      var i = 0;
      var duration = 350;

      var tree = d3.layout.tree()
          .size([360, diameter / 2 - 80])
          .separation(function(a, b) { return (a.parent == b.parent ? 2 : 10) / a.depth; });

      var diagonal = d3.svg.diagonal.radial()
          .projection(function(d) { return [d.y, d.x / 180 * Math.PI]; });

      // Remove the loading text.
      $("#content").empty();

      // Define the div for the tooltip
      var div = d3.select("#content").append("div")
          .attr("class", "tooltip")
          .style("opacity", 0);

      var svg = d3.select("#content")
          .append("svg")
          .attr("width", diameter)
          .attr("height", diameter)
          .append("g")
          .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");

      root.x0 = diameter / 2;
      root.y0 = 0;

      drawGraph(root);

      $('#owner-address-search [disabled]').prop("disabled", false);
      $('#owner-address-search').on('submit', event => {
        event.preventDefault();
        event.stopPropagation();
        var form = $("#owner-address-search");
        var input = $("#owner-address");
        var feedback = $("#owner-address-validation-feedback");
        console.log(form);

        Algorand.getAccountAssets(input.val())
          .then(assets => {
            ownedAssets.length = 0;
            for (var i = 0; i < assets.length; i++) {
              var asset = assets[i];
              if (asset.amount <= 0) continue;

              ownedAssets.push(String(asset['asset-id']));
            }
            input.removeClass('is-invalid');
            input.addClass('is-valid');
            feedback.text('');
            drawGraph(root);
          })
          .catch(e => {
            input.removeClass('is-valid');
            input.addClass('is-invalid');
            feedback.text(e);
            ownedAssets.length = 0;
            drawGraph(root);
          });

        return false;
      });

      function drawGraph(source) {

        // Compute the new tree layout.
        var nodes = tree.nodes(root);
        var links = tree.links(nodes);

        // Normalize for fixed-depth.
        nodes.forEach(function(d) { d.y = d.depth * 125; });

        // Update the nodes…
        var node = svg.selectAll("g.node")
            .data(nodes, function(d) { return d.id || (d.id = ++i); });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .on("click", click)
            .on("mouseover", function(d) {
              if (d == root) return;

              div.transition()
                .duration(200)
                .style("opacity", .9);
              div.html("<dl>" +
                  "<dt>Asset ID:</dt><dd>" + d.id + "</dd>" +
                  "<dt>Asset Name:</dt><dd>" + d.asset.params.name + "</dd>" +
                  "<dt>Name:</dt><dd>"  + d.name + "</dd>" +
                  "<dt>Power:</dt><dd>" + d.metadata.properties['Power'] + "</dd>" +
                  "<dt>Wrestle:</dt><dd>" + d.metadata.properties['Wrestle'] + "</dd>" +
                  "<dt>Stamina:</dt><dd>" + d.metadata.properties['Stamina'] + "</dd>" +
                  "<dt>Appeal:</dt><dd>" + d.metadata.properties['Appeal'] + "</dd>" +
                  "<dt>Speed:</dt><dd>" + d.metadata.properties['Speed'] + "</dd>" +
                  "<dt>Special Move:</dt><dd>" + d.metadata.properties['Special Move'] + "</dd>" +
                  "<dt>Region:</dt><dd>" + d.metadata.properties['Region'] + "</dd>" +
                  "<dt>Power Bonus:</dt><dd>" + d.metadata.properties['Power Bonus'] + "</dd>" +
                  "<dt>Wrestle Bonus:</dt><dd>" + d.metadata.properties['Wrestle Bonus'] + "</dd>" +
                  "<dt>Mutation:</dt><dd>" + d.metadata.properties['Mutation'] + "</dd>" +
                  "<dt>Sex:</dt><dd>" + d.metadata.properties['Sex'] + "</dd>" +
                  "<dt>Mother:</dt><dd>" + d.metadata.properties['Mother'] + "</dd>" +
                  "<dt>Father:</dt><dd>" + d.metadata.properties['Father'] + "</dd>" +
                  "<dt>Highlights:</dt><dd>" + d.metadata.properties['Highlights'] + "</dd>" +
                  "<dt>Background:</dt><dd>" + d.metadata.properties['Background'] + "</dd>" +
                  "<dt>Children:</dt><dd>" + (d.children ? d.children.length : 0) + "</dd>" +
                  "<dt>Descendants:</dt><dd>" + Graph.descendants(d) + "</dd>" +
                  "</dl>")
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 75) + "px");
            })
            .on("mouseout", function(d) {
              div.transition()
                .duration(500)
                .style("opacity", 0);
            });

        nodeEnter.append("circle")
            .attr("r", 1e-6)
            .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

        nodeEnter.append("text")
            .attr("dx", 10)
            .attr("dy", ".35em")
            .attr("text-anchor", "start")
            .text(function(d) { return d.name; })
            .style("fill-opacity", 1e-6);

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })

        nodeUpdate.select("circle")
            .attr("r", 4.5)
            .style("stroke", function(d) { return ownedAssets.includes(d.id) ? "red" : "steelblue"; })
            .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

        nodeUpdate.select("text")
            .style("fill-opacity", 1)
            .attr("dx", d => d.x < 180 ? 8 : -8)
            .attr("text-anchor", d => d.x < 180 ? "start" : "end")
            .attr("transform", d =>  d.x < 180 ? null : "rotate(180)")

        var nodeExit = node.exit().transition()
            .duration(duration)
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // Update the links…
        var link = svg.selectAll("path.link")
            .data(links, function(d) { return d.target.id; });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function(d) {
              var o = { x: source.x0, y: source.y0 };
              return diagonal({source: o, target: o});
            });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
              var o = {x: source.x, y: source.y};
              return diagonal({source: o, target: o});
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
          d.x0 = d.x;
          d.y0 = d.y;
        });
      }

      // Toggle children on click.
      function click(d) {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          d.children = d._children;
          d._children = null;
        }

        drawGraph(d);
      }
    });
}(jQuery, document, window));
