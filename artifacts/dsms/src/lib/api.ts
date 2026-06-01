import { setAuthTokenGetter } from "@workspace/api-client-react";

export function initApi() {
  setAuthTokenGetter(() => {
    return localStorage.getItem("dsms_token");
  });
}
