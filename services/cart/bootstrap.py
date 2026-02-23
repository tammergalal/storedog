from ddtrace import patch_all

# H8: tracer.configure() is deprecated; DD_AGENT_HOST and DD_TRACE_AGENT_PORT
# env vars are read automatically by ddtrace-run, so no manual config needed.
patch_all()
