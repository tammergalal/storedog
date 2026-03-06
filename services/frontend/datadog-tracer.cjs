const tracer = require('dd-trace').init({
  propagation: {
    extract: ['tracecontext', 'datadog'],
    inject: ['tracecontext', 'datadog']
  }
});
module.exports = tracer;
