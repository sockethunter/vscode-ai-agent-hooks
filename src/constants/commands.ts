export const COMMANDS = {
  SELECT_PROVIDER: "ai-agent-hooks.selectProvider",
  TEST_PROVIDER: "ai-agent-hooks.testProvider",
  MANAGE_HOOKS: "ai-agent-hooks.manageHooks",
} as const;

export const WEBVIEW_COMMANDS = {
  CREATE_HOOK: "createHook",
  GET_HOOKS: "getHooks",
  TOGGLE_HOOK: "toggleHook",
  DELETE_HOOK: "deleteHook",
  STOP_HOOK: "stopHook",
  UPDATE_HOOKS: "updateHooks",
  HOOK_CREATED: "hookCreated",
  ERROR: "error",
} as const;
