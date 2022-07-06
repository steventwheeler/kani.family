(function($, document) {
  var BrowserText = (function () {
      var canvas = document.createElement('canvas'),
          context = canvas.getContext('2d');

      /**
       * Measures the rendered width of arbitrary text given the font size and font face
       * @param {string} text The text to measure
       * @param {number} fontSize The font size in pixels
       * @param {string} fontFace The font face ("Arial", "Helvetica", etc.)
       * @returns {number} The width of the text
       **/
      function getWidth(text, fontSize, fontFace) {
          context.font = fontSize + 'px ' + fontFace;
          return context.measureText(text).width;
      }

      return {
          getWidth: getWidth
      };
  })();

  $(document).ready(function() {
    $.ajax({
      url: 'family_tree.json',
      success: function(root) {
        function treeDepth(node) {
          var max = 0;
          for (var i = 0; i < node.children.length; i++) {
            var childDepth = treeDepth(node.children[i]);
            if (childDepth > max) max = childDepth;
          }
          return max + 1;
        }

        var depth = treeDepth(root);
        var diameter = depth * 250;

        var i = 0;
        var duration = 350;

        var tree = d3.layout.tree()
            .size([360, diameter / 2 - 80])
            .separation(function(a, b) { return (a.parent == b.parent ? 1 : 10) / a.depth; });

        var diagonal = d3.svg.diagonal.radial()
            .projection(function(d) { return [d.y, d.x / 180 * Math.PI]; });

        var svg = d3.select("body")
            .append("svg")
            .attr("width", diameter)
            .attr("height", diameter)
            .append("g")
            .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");

        root.x0 = diameter / 2;
        root.y0 = 0;

        update(root);

        function update(source) {

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
              .on("click", click);

          nodeEnter.append("circle")
              .attr("r", 1e-6)
              .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

          var text = nodeEnter.append("text")
              .attr("x", 10)
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
              .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

          nodeUpdate.select("text")
              .style("fill-opacity", 1)
              .attr("transform", function(d) { return d.x < 180 ? "translate(0)" : "rotate(180)translate(-" + (BrowserText.getWidth(d.name, 10) + 30)  + ")"; });

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

          update(d);
        }

        // Collapse nodes
        function collapse(d) {
          if (d.children) {
              d._children = d.children;
              d._children.forEach(collapse);
              d.children = null;
            }
        }
      },
    });
  });
}(jQuery, document));
