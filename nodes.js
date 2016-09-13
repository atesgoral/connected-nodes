function Nodes(canvas, config) {
  var width = canvas.offsetWidth;
  var height = canvas.offsetHeight;

  canvas.width = width * 2;
  canvas.height = height * 2;

  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  var origin = {
    x: width / 2,
    y: height / 2
  };

  var world = {
    w: width,
    h: height
  };

  var ctx = canvas.getContext('2d');

  ctx.scale(2, 2);

  var nodes;
  var connections;

  function process() {
    var now = Date.now();

    if (config.conn.isEnabled) {
      for (var cid in connections) {
        var connection = connections[cid];
        var elapsed = now - connection.t;

        switch (connection.state) {
        case 'CONNECTING':
          if (elapsed >= config.conn.fade) {
            connection.state = 'CONNECTED';
            connection.t = now;
          }
          break;
        case 'DISCONNECTING':
          if (elapsed >= config.conn.fade) {
            connection.node1.connections--;
            connection.node2.connections--;
            delete connections[cid];
          }
          break;
        }
      }
    } else {
      connections = {};
    }

    for (var idx = 0; idx < nodes.length; idx++) {
      var node = nodes[idx];
      var velocity = (config.node.maxVelocity - config.node.minVelocity) * node.v + config.node.minVelocity;

      node.x += Math.cos(node.a) * velocity;
      node.y += Math.sin(node.a) * velocity;

      if (node.x < -world.w / 2 || node.x > world.w / 2) {
        node.a = Math.PI - node.a;
      }

      if (node.y < -world.h / 2 || node.y > world.h / 2) {
        node.a = 2 * Math.PI - node.a;
      }

      var elapsed = now - node.t;

      switch (node.state) {
      case 'HIDING':
        if (elapsed >= node.hideDuration) {
          node.state = 'SPAWNING';
          node.t = now;
        }
        continue;
      case 'SPAWNING':
        if (elapsed >= config.node.fade) {
          node.state = 'SILENT';
          node.silence = Math.random();
          node.t = now;
        }
        continue;
      case 'SILENT':
        if (config.wave.isEnabled && elapsed >= (config.wave.maxWait - config.wave.minWait) * node.silence + config.wave.minWait) {
          var waveCount = Math.floor((config.wave.maxCount - config.wave.minCount) * Math.random()) + config.wave.minCount;

          for (var i = 0; i < waveCount; i++) {
            node.waves.push({
              t: now,
              delay: config.wave.duration / 3 * i
            });
          }

          node.state = 'EMITTING';
          node.t = now;
        }
        break;
      case 'EMITTING':
        node.waves = node.waves.filter(function (wave) {
          return now - wave.delay - wave.t <= config.wave.duration
        });

        if (!node.waves.length) {
          node.state = 'SILENT';
          node.silence = Math.random();
          node.t = now;
        }
        break;
      }

      if (!config.conn.isEnabled) {
        node.connections = 0;
        continue;
      }

      for (var otherIdx = idx + 1; otherIdx < nodes.length; otherIdx++) {
        var otherNode = nodes[otherIdx];

        if (otherNode.state === 'HIDING' || otherNode.state === 'SPAWNING') {
          continue;
        }

        var cid = idx + '-' + otherIdx;
        var dx = node.x - otherNode.x;
        var dy = node.y - otherNode.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var connection = connections[cid];

        if (d <= config.conn.maxDistance && d >= config.conn.minDistance) {
          if (
            !connection
            && node.connections < config.conn.maxPerNode
            && otherNode.connections < config.conn.maxPerNode
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
      }
    }
  }

  function paint() {
    var now = Date.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var cid in connections) {
      var connection = connections[cid];

      switch (connection.state) {
      case 'CONNECTING':
        ctx.globalAlpha = Math.min(1, (now - connection.t) / config.conn.fade) * config.conn.opacity;
        break;
      case 'DISCONNECTING':
        ctx.globalAlpha = (1 - Math.min(1, (now - connection.t) / config.conn.fade)) * config.conn.opacity;
        break;
      default:
        ctx.globalAlpha = config.conn.opacity;
      }

      ctx.strokeStyle = config.conn.color;
      ctx.beginPath();
      ctx.moveTo(origin.x + connection.node1.x, origin.y + connection.node1.y);
      ctx.lineTo(origin.x + connection.node2.x, origin.y + connection.node2.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    for (var idx = 0; idx < nodes.length; idx++) {
      var node = nodes[idx];

      if (node.state === 'HIDING') {
        continue;
      }

      if (node.state === 'SPAWNING') {
        ctx.globalAlpha = Math.max(0, now - node.t) / config.node.fade * config.node.opacity;
      } else {
        ctx.globalAlpha = config.node.opacity;
      }

      var nodeRadius = (config.node.maxRadius - config.node.minRadius) * node.r + config.node.minRadius;

      ctx.fillStyle = config.node.color;
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

      for (var waveIdx = 0; waveIdx < node.waves.length; waveIdx++) {
        var wave = node.waves[waveIdx];
        var elapsed = now - wave.delay - wave.t;

        if (elapsed < 0) {
          continue;
        }

        var n = Math.max(0, config.wave.duration - elapsed) / config.wave.duration;

        ctx.globalAlpha = n * config.wave.opacity;
        ctx.strokeStyle = config.wave.color;
        ctx.beginPath();
        ctx.arc(
          origin.x + node.x,
          origin.y + node.y,
          nodeRadius + (1 - n) * config.wave.maxDistance,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }
  }

  var spawnTimeout;
  var tickTimeout;

  function tick() {
    paint();
    process();
    tickTimeout = setTimeout(tick, 1000 / 25);
  }

  function spawnNode(spawnMinRadius, spawnMaxRadius, maxHideDuration) {
    var a = Math.random() * Math.PI * 2;
    var r = (spawnMaxRadius - spawnMinRadius) * Math.random() + spawnMinRadius;
    var newNode = {
      x: Math.cos(a) * r * world.w / 2,
      y: Math.sin(a) * r * world.h / 2,
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
    spawnSteps = config.spawnSteps.slice(0);
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
