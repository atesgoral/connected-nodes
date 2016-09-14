function Nodes(canvas, config) {
  var scale = 500;

  var width = canvas.offsetWidth;
  var height = canvas.offsetHeight;

  canvas.width = width * 2;
  canvas.height = height * 2;

  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  var ctx = canvas.getContext('2d');

  ctx.scale(height * 2, height * 2);

  ctx.lineWidth = 1 / scale;

  var scene = {
    w: width / height,
    h: 1,
    nodes: [],
    connectors: {}
  };

  function progress(scene, config) {
    var now = Date.now();

    if (config.conn.isEnabled) {
      for (var cid in scene.connectors) {
        var connector = scene.connectors[cid];
        var elapsed = now - connector.t;

        switch (connector.state) {
        case 'CONNECTING':
          if (elapsed >= config.conn.fade) {
            connector.state = 'CONNECTED';
            connector.t = now;
          }
          break;
        case 'DISCONNECTING':
          if (elapsed >= config.conn.fade) {
            connector.node1.connections--;
            connector.node2.connections--;
            delete scene.connectors[cid];
          }
          break;
        }
      }
    } else {
      scene.connectors = {};
    }

    for (var idx = 0; idx < scene.nodes.length; idx++) {
      var node = scene.nodes[idx];
      var velocity = ((config.node.maxVelocity - config.node.minVelocity) * node.v + config.node.minVelocity) / scale;
      var nodeRadius = ((config.node.maxRadius - config.node.minRadius) * node.r + config.node.minRadius) / scale;

      node.x += Math.cos(node.a) * velocity;
      node.y += Math.sin(node.a) * velocity;

      if (node.x < nodeRadius || node.x >= scene.w - nodeRadius) {
        node.a = Math.PI - node.a;
      }

      if (node.y < nodeRadius || node.y >= scene.h - nodeRadius) {
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

      for (var otherIdx = idx + 1; otherIdx < scene.nodes.length; otherIdx++) {
        var otherNode = scene.nodes[otherIdx];

        if (otherNode.state === 'HIDING' || otherNode.state === 'SPAWNING') {
          continue;
        }

        var cid = idx + '-' + otherIdx;
        var dx = node.x - otherNode.x;
        var dy = node.y - otherNode.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var connector = scene.connectors[cid];

        if (d <= config.conn.maxDistance / scale && d >= config.conn.minDistance / scale) {
          if (
            !connector
            && node.connections < config.conn.maxPerNode
            && otherNode.connections < config.conn.maxPerNode
          ) {
            scene.connectors[cid] = {
              state: 'CONNECTING',
              t: now,
              node1: node,
              node2: otherNode
            };
            node.connections++;
            otherNode.connections++;
          }
        } else {
          if (connector && connector.state === 'CONNECTED') {
            connector.state = 'DISCONNECTING';
            connector.t = now;
          }
        }
      }
    }
  }

  function render(ctx, scene, config) {
    var now = Date.now();

    ctx.clearRect(0, 0, scene.w, scene.h);

    for (var cid in scene.connectors) {
      var connection = scene.connectors[cid];

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
      ctx.moveTo(connection.node1.x, connection.node1.y);
      ctx.lineTo(connection.node2.x, connection.node2.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    for (var idx = 0; idx < scene.nodes.length; idx++) {
      var node = scene.nodes[idx];

      if (node.state === 'HIDING') {
        continue;
      }

      if (node.state === 'SPAWNING') {
        ctx.globalAlpha = Math.max(0, now - node.t) / config.node.fade * config.node.opacity;
      } else {
        ctx.globalAlpha = config.node.opacity;
      }

      var nodeRadius = ((config.node.maxRadius - config.node.minRadius) * node.r + config.node.minRadius) / scale;

      ctx.fillStyle = config.node.color;
      ctx.beginPath();
      ctx.arc(
        node.x,
        node.y,
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
          node.x,
          node.y,
          nodeRadius + (1 - n) * config.wave.maxDistance / scale,
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
    render(ctx, scene, config);
    progress(scene, config);
    tickTimeout = setTimeout(tick, 1000 / 25);
  }

  function spawnNode(spawnMinRadius, spawnMaxRadius, maxHideDuration) {
    var r = Math.random();
    var nodeRadius = ((config.node.maxRadius - config.node.minRadius) * r + config.node.minRadius) / scale;

    var node = {
      x: (((spawnMaxRadius - spawnMinRadius) * Math.random() + spawnMinRadius) / 2 * (Math.random() < 0.5 ? -1 : 1) + 0.5) * ((scene.w - nodeRadius * 2) + nodeRadius),
      y: Math.random() * ((scene.h - nodeRadius * 2) + nodeRadius),
      a: 2 * Math.PI * Math.random(),
      v: Math.random(),
      r: r,
      t: Date.now(),
      waves: [],
      state: 'HIDING',
      hideDuration: maxHideDuration * Math.random(),
      connections: 0
    };

    scene.nodes.push(node);
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

    spawnNodes();
    tick();
  }

  this.restart = function () {
    clearTimeout(tickTimeout);
    clearTimeout(spawnTimeout);

    scene.nodes = [];
    scene.connectors = {};

    start();
  }

  start();
}
