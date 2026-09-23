import { useCallback, useEffect, useState } from "react";
import { PORTAL_URL } from "../config.js";

// Public browser client (Authorization Code + PKCE, no secret).
const CLIENT_ID = import.meta.env.VITE_ARCGIS_OAUTH_CLIENT_ID;
const SHARING_URL = `${PORTAL_URL}/sharing`;

// Imported on demand so the sign-in screen can render before the SDK's
// identity code has downloaded. Registration happens once, on first load.
let identityPromise = null;
function loadIdentity() {
  identityPromise ??= Promise.all([
    import("@arcgis/core/identity/OAuthInfo.js"),
    import("@arcgis/core/identity/IdentityManager.js"),
  ]).then(([{ default: OAuthInfo }, { default: esriId }]) => {
    esriId.registerOAuthInfos([
      new OAuthInfo({ appId: CLIENT_ID, portalUrl: PORTAL_URL, popup: false, flowType: "auto" }),
    ]);
    return esriId;
  });
  return identityPromise;
}

export function useAuth() {
  const [state, setState] = useState({ status: "checking", username: null, error: null });

  useEffect(() => {
    if (!CLIENT_ID) {
      setState({
        status: "error",
        username: null,
        error: "Sign-in isn't configured (missing VITE_ARCGIS_OAUTH_CLIENT_ID in .env.local).",
      });
      return;
    }
    let cancelled = false;
    loadIdentity()
      .then((esriId) => esriId.checkSignInStatus(SHARING_URL))
      .then((credential) => {
        if (!cancelled) setState({ status: "signed-in", username: credential.userId, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "signed-out", username: null, error: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // popup: false navigates the page to ArcGIS Online and back, so this
  // promise never settles in the current page.
  const signIn = useCallback(() => {
    loadIdentity().then((esriId) => esriId.getCredential(SHARING_URL));
  }, []);

  const signOut = useCallback(() => {
    loadIdentity().then((esriId) => {
      esriId.destroyCredentials();
      window.location.reload();
    });
  }, []);

  return { ...state, signIn, signOut };
}
