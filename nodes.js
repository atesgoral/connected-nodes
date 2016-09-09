var SPAWN_STEPS = [{
  d: 3000,
  r: 0.25,
  n: 10
}, {
  d: 1000,
  r: .5,
  n: 50
}, {
  d: 1000,
  r: 1,
  n: 100
}];
var NODE_SILENT_DURATION = 40000;

function Nodes(canvas, config) {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  var origin = {
    x: canvas.width/ 2,
    y: canvas.height/ 2
  };

  var ctx = canvas.getContext('2d');

  var nodes;
  var connections;

  function process() {
    var now = Date.now();

    nodes.forEach(function (node, idx) {
      var velocity = (config.nodeMaxVelocity - config.nodeMinVelocity) * node.v + config.nodeMinVelocity;

      node.x += Math.cos(node.a) * velocity;
      node.y += Math.sin(node.a) * velocity;

      if (node.x < -origin.x || node.x > origin.x) {
        node.a = Math.PI - node.a;
      }

      if (node.y < -origin.y || node.y > origin.y) {
        node.a = 2 * Math.PI - node.a;
      }

      var elapsed = now - node.t;

      switch (node.state) {
      case 'HIDING':
        if (elapsed >= node.hideDuration) {
          node.state = 'SPAWNING';
          node.t = now;
        }
        return;
      case 'SPAWNING':
        if (elapsed >= config.nodeFade) {
          node.state = 'SILENT';
          node.t = now - Math.random() * NODE_SILENT_DURATION;
        }
        return;
      case 'SILENT':
        if (config.wavesEnabled && elapsed >= NODE_SILENT_DURATION) {
          var waveCount = Math.floor((config.waveMaxCount - config.waveMinCount) * Math.random()) + config.waveMinCount;

          for (var i = 0; i < waveCount; i++) {
            node.waves.push({
              t: now,
              delay: config.waveDuration / 3 * i
            });
          }

          node.state = 'EMITTING';
          node.t = now;
        }
        break;
      case 'EMITTING':
        node.waves = node.waves.filter(function (wave) {
          return now - wave.delay - wave.t <= config.waveDuration
        });

        if (!node.waves.length) {
          node.state = 'SILENT';
          node.t = now;
        }
        break;
      }

      if (!config.connsEnabled) {
        connections = {};
        return;
      }

      for (var cid in connections) {
        var connection = connections[cid];
        var elapsed = now - connection.t;

        switch (connection.state) {
        case 'CONNECTING':
          if (elapsed >= config.connFade) {
            connection.state = 'CONNECTED';
            connection.t = now;
          }
          break;
        case 'DISCONNECTING':
          if (elapsed >= config.connFade) {
            connection.node1.connections--;
            connection.node2.connections--;
            delete connections[cid];
          }
          break;
        }
      }

      nodes
        .slice(idx + 1)
        .filter(function (otherNode) {
          return otherNode.state !== 'HIDING' && otherNode.state !== 'SPAWNING';
        })
        .forEach(function (otherNode, otherIdx) {
          var cid = idx + '-' + otherIdx;
          var dx = node.x - otherNode.x;
          var dy = node.y - otherNode.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var connection = connections[cid];

          if (d <= config.connMaxDistance) {
            if (
              !connection
              && node.connections < config.connMaxPerNode
              && otherNode.connections < config.connMaxPerNode
            ) {
              connections[cid] = {
                state: 'CONNECTING',
                t: now,
                node1: node,
                node2: otherNode
              };
              node.connections++;
              otherNode.connections++;
            }
          } else {
            if (connection && connection.state === 'CONNECTED') {
              connection.state = 'DISCONNECTING';
              connection.t = now;
            }
          }
        });
    });
  }

  function paint() {
    var now = Date.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var cid in connections) {
      var connection = connections[cid];

      switch (connection.state) {
      case 'CONNECTING':
        ctx.globalAlpha = Math.min(1, (now - connection.t) / config.connFade) * config.connOpacity;
        break;
      case 'DISCONNECTING':
        ctx.globalAlpha = (1 - Math.min(1, (now - connection.t) / config.connFade)) * config.connOpacity;
        break;
      default:
        ctx.globalAlpha = config.connOpacity;
      }

      ctx.strokeStyle = config.connColor;
      ctx.beginPath();
      ctx.moveTo(origin.x + connection.node1.x, origin.y + connection.node1.y);
      ctx.lineTo(origin.x + connection.node2.x, origin.y + connection.node2.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    nodes.forEach(function (node) {
      if (node.state === 'HIDING') {
        return;
      }

      if (node.state === 'SPAWNING') {
        ctx.globalAlpha = Math.max(0, now - node.t) / config.nodeFade * config.nodeOpacity;
      } else {
        ctx.globalAlpha = config.nodeOpacity;
      }

      var nodeRadius = (config.nodeMaxRadius - config.nodeMinRadius) * node.r + config.nodeMinRadius;

      ctx.fillStyle = config.nodeColor;
      ctx.beginPath();
      ctx.arc(
        origin.x + node.x,
        origin.y + node.y,
        nodeRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.globalAlpha = 1;

      node.waves.forEach(function (wave) {
        var elapsed = now - wave.delay - wave.t;

        if (elapsed < 0) {
          return;
        }

        var n = Math.max(0, config.waveDuration - elapsed) / config.waveDuration;

        ctx.globalAlpha = n * config.waveOpacity;
        ctx.strokeStyle = config.waveColor;
        ctx.beginPath();
        ctx.arc(
          origin.x + node.x,
          origin.y + node.y,
          nodeRadius + (1 - n) * config.waveMaxDistance,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
    });
  }

  var spawnTimeout;
  var tickTimeout;

  function tick() {
    paint();
    process();
    tickTimeout = setTimeout(tick, 1000 / 50);
  }

  function spawnNode(spawnMinRadius, spawnMaxRadius, maxHideDuration) {
    var a = Math.random() * Math.PI * 2;
    var r = (spawnMaxRadius - spawnMinRadius) * Math.random() + spawnMinRadius;
    var newNode = {
      x: Math.cos(a) * r * origin.x,
      y: Math.sin(a) * r * origin.y,
      a: 2 * Math.PI * Math.random(),
      v: Math.random(),
      r: Math.random(),
      t: Date.now(),
      waves: [],
      state: 'HIDING',
      hideDuration: maxHideDuration * Math.random(),
      connections: 0
    };

    nodes.push(newNode);
  }

  var spawnSteps;
  var prevMinRadius;

  function spawnNodes() {
    var spawnStep = spawnSteps[0];

    for (var i = 0; i < spawnStep.n; i++) {
      spawnNode(prevMinRadius, spawnStep.r, spawnStep.d);
    }

    prevMinRadius = spawnStep.r;
    spawnSteps.shift();

    if (spawnSteps.length) {
      spawnTimeout = setTimeout(spawnNodes, spawnStep.d);
    }
  }

  function start() {
    spawnSteps = SPAWN_STEPS.slice(0);
    prevMinRadius = 0;

    nodes = [];
    connections = {};

    spawnNodes();
    tick();
  }

  this.restart = function () {
    clearTimeout(tickTimeout);
    clearTimeout(spawnTimeout);
    start();
  }

  start();
}
