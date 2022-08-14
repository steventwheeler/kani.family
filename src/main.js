'use strict';

import Algorand from "./algorand.js";
import Graph from "./graph.js";
import ARC19 from "./arc19.js";
import * as IPFS from "ipfs-core";
const toBuffer = require('it-to-buffer');

const creatorAddress = "KANIGZX2NQKJKYJ425BWYKCT5EUHSPBRLXEJLIT2JHGTWOJ2MLYCNIVHFI";
const ownedAssets = [];
const algorandClient = new Algorand();

function metadataToNode(id, asset, metadata) {
  var name = metadata.description;
  if (name) name = name.replace(/^\s*Kani World - /i, "");
  return {
    id: id,
    children: [],
    asset: asset,
    metadata: metadata,
    name: name,
  };
}

Promise.all([algorandClient.getAssets(creatorAddress), algorandClient.getAssetConfigTransactions(creatorAddress), IPFS.create()])
  .then(values => {
    var assets = values[0];
    var transactions = values[1];
    var ipfs = values[2];

    // Ensure that the list of transactions is sorted by the confirmed
    // round time.
    transactions.sort((a, b) => a["confirmed-round"] - b["confirmed-round"]);

    // Collect the data for each asset.
    Promise.all(assets.map(asset => {
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
      .then(nodes => {
        // Sort the nodes by the id.
        nodes.sort((a, b) => a.id - b.id);

        // Build a graph of each nodes paternity.
        var root = { id: "Original8", name: "Original8", children: [] };
        var graph = new Graph();
        graph.addRoot(root);
        nodes.forEach((node, i) => {
          // Skip the queens.
          if (["394248226", "394250676", "394243491", "394251425"].includes(node.id)) return;

          var father = graph.findById(String(node.metadata.properties["Father"]));
          father.children.push(node);
        });

        // Sort the children in ascending order.
        const queue = [root]
        while (queue.length > 0) {
          var node = queue.shift();
          queue.push(...node.children);

          node.children.sort((a, b) => -1 * (graph.descendants(a) - graph.descendants(b)));
        }

        // Initialize the tree view.
        var height = graph.height(root);
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

          algorandClient.getAccountAssets(input.val())
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
                var html = "<dl>" +
                  "<dt>Asset ID:</dt><dd>" + d.id + "</dd>" +
                  "<dt>Asset Name:</dt><dd>" + d.asset.params.name + "</dd>" +
                  "<dt>Name:</dt><dd>"  + d.name + "</dd>";
                for (var property in d.metadata.properties) {
                  if (d.metadata.properties.hasOwnProperty(property)) {
                    html += "<dt>" + property + ":</dt><dd>" + d.metadata.properties[property] + "</dd>";
                  }
                }
                html += "<dt>Children:</dt><dd>" + (d.children ? d.children.length : 0) + "</dd>" +
                  "<dt>Descendants:</dt><dd>" + graph.descendants(d) + "</dd>" +
                  "</dl>";
                div.html(html)
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
  });
