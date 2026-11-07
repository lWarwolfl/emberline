export const DIRECT_ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

/** Fetch fresh relay credentials for every new room; static/offline installs can use direct ICE. */
export async function roomIce(fetcher = fetch): Promise<RTCConfiguration> {
  if (!/^https?:$/.test(location.protocol)) return DIRECT_ICE;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetcher("/api/party/ice", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 404) return DIRECT_ICE;
    if (!response.ok) throw new Error("The room relay is unavailable. Try again shortly.");
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("iceServers" in data) ||
      !Array.isArray(data.iceServers)
    )
      throw new Error("The room relay returned an invalid configuration.");
    const iceServers: RTCIceServer[] = data.iceServers.map((server: unknown) => {
      if (!server || typeof server !== "object" || !("urls" in server))
        throw new Error("The room relay returned an invalid server.");
      const urls = typeof server.urls === "string" ? [server.urls] : server.urls;
      if (
        !Array.isArray(urls) ||
        !urls.length ||
        urls.some((url: unknown) => typeof url !== "string" || !/^(?:stun|turn)s?:/.test(url))
      )
        throw new Error("The room relay returned an invalid server address.");
      const username =
        "username" in server && typeof server.username === "string" ? server.username : undefined;
      const credential =
        "credential" in server && typeof server.credential === "string"
          ? server.credential
          : undefined;
      if (urls.some((url: string) => /^turns?:/.test(url)) && (!username || !credential))
        throw new Error("The room relay credentials are missing.");
      return { urls, ...(username ? { username } : {}), ...(credential ? { credential } : {}) };
    });
    return { iceServers };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Room setup timed out. Check your connection and try again.", {
        cause: error,
      });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
