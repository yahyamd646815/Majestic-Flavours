// TypeScript 6 does not pull in `@types/*` packages automatically, so the Jest
// globals (`describe`, `it`, `expect`, `jest`) are referenced explicitly here
// rather than widening the whole project's tsconfig for one test file.
/// <reference types="jest" />

import * as Notifications from "expo-notifications";

import { getExpoPushToken } from "@/lib/notifications";

/**
 * `getExpoPushToken` is a thin wrapper over a native module, so what is worth
 * pinning is not the token itself but the mapping from each way the call can
 * end to a result that says *which* way it ended. Collapsing all of them to
 * null is what let a missing `google-services.json` masquerade as a refused
 * permission for weeks.
 */
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
}));

/** Read through a getter so a single test can drop the projectId without
 * re-mocking the module — factory-scope names must start with `mock`. */
let mockProjectId: string | null = "23fd4d8b-a07c-429b-880c-9f90d56e86b8";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: { eas: mockProjectId === null ? {} : { projectId: mockProjectId } } };
    },
  },
}));

const getPermissionsAsync = Notifications.getPermissionsAsync as jest.MockedFunction<
  typeof Notifications.getPermissionsAsync
>;
const requestPermissionsAsync = Notifications.requestPermissionsAsync as jest.MockedFunction<
  typeof Notifications.requestPermissionsAsync
>;
const getExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.MockedFunction<
  typeof Notifications.getExpoPushTokenAsync
>;

function permissionStatus(
  granted: boolean,
  canAskAgain: boolean,
): Notifications.NotificationPermissionsStatus {
  return {
    granted,
    canAskAgain,
    expires: "never",
    status: granted ? Notifications.PermissionStatus.GRANTED : Notifications.PermissionStatus.DENIED,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProjectId = "23fd4d8b-a07c-429b-880c-9f90d56e86b8";
});

describe("getExpoPushToken", () => {
  it("returns the token and passes the EAS projectId through", async () => {
    getPermissionsAsync.mockResolvedValue(permissionStatus(true, true));
    getExpoPushTokenAsync.mockResolvedValue({ type: "expo", data: "ExponentPushToken[abc]" });

    const result = await getExpoPushToken();

    expect(result).toEqual({ status: "ok", token: "ExponentPushToken[abc]" });
    expect(getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "23fd4d8b-a07c-429b-880c-9f90d56e86b8",
    });
    // Already granted: nobody is re-prompted just for opening the app.
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("asks when the permission has not been decided yet", async () => {
    getPermissionsAsync.mockResolvedValue(permissionStatus(false, true));
    requestPermissionsAsync.mockResolvedValue(permissionStatus(true, true));
    getExpoPushTokenAsync.mockResolvedValue({ type: "expo", data: "ExponentPushToken[xyz]" });

    expect(await getExpoPushToken()).toEqual({ status: "ok", token: "ExponentPushToken[xyz]" });
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("reports a refusal that can still be asked about again as denied", async () => {
    getPermissionsAsync.mockResolvedValue(permissionStatus(false, true));
    requestPermissionsAsync.mockResolvedValue(permissionStatus(false, true));

    expect(await getExpoPushToken()).toEqual({ status: "no-permission", permission: "denied" });
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("reports a permission the OS will no longer prompt for as blocked", async () => {
    getPermissionsAsync.mockResolvedValue(permissionStatus(false, false));

    expect(await getExpoPushToken()).toEqual({ status: "no-permission", permission: "blocked" });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("reports the native error code when the token request fails", async () => {
    // The real shape of the Android/FCM failure this bug turned out to be:
    // no `google-services.json` in the build, so Firebase never initialises.
    getPermissionsAsync.mockResolvedValue(permissionStatus(true, true));
    getExpoPushTokenAsync.mockRejectedValue(
      Object.assign(
        new Error("Unable to get Firebase Messaging instance. Did you configure `googleServicesFile` path in app config?"),
        { code: "E_REGISTRATION_FAILED" },
      ),
    );

    const result = await getExpoPushToken();

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("E_REGISTRATION_FAILED");
    expect(result.status === "failed" && result.reason).toContain("googleServicesFile");
  });

  it("reports a missing EAS projectId rather than calling without one", async () => {
    getPermissionsAsync.mockResolvedValue(permissionStatus(true, true));
    mockProjectId = null;

    const result = await getExpoPushToken();

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("projectId");
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});
