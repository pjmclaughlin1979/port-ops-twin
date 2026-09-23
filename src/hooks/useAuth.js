import { useCallback, useEffect, useState } from "react";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo.js";
import esriId from "@arcgis/core/identity/IdentityManager.js";
import { PORTAL_URL } from "../config.js";

// Public browser client (Authorization Code + PKCE, no secret).
const CLIENT_ID = import.meta.env.VITE_ARCGIS_OAUTH_CLIENT_ID;
const SHARING_URL = `${PORTAL_URL}/sharing`;

let registered = false;
function registerOAuth() {
  if (registered || !CLIENT_ID) return;
  esriId.registerOAuthInfos([
    new OAuthInfo({ appId: CLIENT_ID, portalUrl: PORTAL_URL, popup: false, flowType: "auto" }),
  ]);
  registered = true;
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
    registerOAuth();
    esriId
      .checkSignInStatus(SHARING_URL)
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
    registerOAuth();
    esriId.getCredential(SHARING_URL);
  }, []);

  const signOut = useCallback(() => {
    esriId.destroyCredentials();
    window.location.reload();
  }, []);

  return { ...state, signIn, signOut };
}
