import Editor from "@monaco-editor/react";
import { waitNostr } from "nip07-awaiter";
import { useEffect, useState } from "react";
import { Nip07 } from "nostr-typedef";
import { SimplePool } from "nostr-tools";

let nip07: Nip07.Nostr;

const pool = new SimplePool();

function App() {
  const [pubkey, setPubkey] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [signedJson, setSignedJson] = useState("");
  const [replaceCreatedAt, setReplaceCreatedAt] = useState(true);
  const [relayInput, setRelayInput] = useState("");
  const [relays, setRelays] = useState<string[]>([]);

  useEffect(() => {
    waitNostr(5000).then(async (nostr) => {
      nip07 = nostr as Nip07.Nostr;
      const pub = await nostr?.getPublicKey();
      if (pub) {
        setPubkey(pub);
      }
    });

    const strRelays = localStorage.getItem("nostr-raw-writer.relays");
    if (strRelays) {
      setRelays(JSON.parse(strRelays));
    }
  }, []);

  useEffect(() => {
    setRawJson(`{
  "pubkey": "${pubkey}",
  "created_at": ${Math.floor(Date.now() / 1000)},
  "kind": 1,
  "tags": [],
  "content": ""
}`);
  }, [pubkey]);

  const addRelay = () => {
    const newRelays = [...relays, relayInput];
    setRelays(newRelays);
    localStorage.setItem("nostr-raw-writer.relays", JSON.stringify(newRelays));
  };

  const removeRelay = (index: number) => {
    const newRelays = [...relays];
    newRelays.splice(index, 1);
    setRelays(newRelays);
    localStorage.setItem("nostr-raw-writer.relays", JSON.stringify(newRelays));
  };

  const sign = async () => {
    try {
      if (!nip07) throw Error("NIP-07 extension is not found.");
      const parsed = JSON.parse(rawJson);
      if (replaceCreatedAt) {
        parsed.created_at = Math.floor(Date.now() / 1000);
      }
      const signed = await nip07.signEvent(parsed);
      setSignedJson(JSON.stringify(signed, null, 2));
      return signed;
    } catch (e) {
      alert(String(e));
      throw e;
    }
  };

  const signAndPublish = async () => {
    sign()
      .then(async (signed) => {
        const statuses = await Promise.allSettled(pool.publish(relays, signed));
        if (
          statuses.filter(({ status }) => status === "fulfilled").length < 1
        ) {
          alert("Failed to publish to all relays.");
        }
      })
      .catch(() => null);
  };

  return (
    <div style={{ padding: "0 2rem", width: "calc(100vw - 4rem)" }}>
      <div>
        <h1>N Raw Writer</h1>
        <p>
          Sign Nostr's raw JSON event with NIP-07 and propagate it to the relay.
        </p>
      </div>
      <div>
        <h2>Raw JSON</h2>
        <Editor
          height="300px"
          defaultLanguage="json"
          theme="vs-dark"
          options={{
            cursorStyle: "line",
            formatOnPaste: true,
            formatOnType: true,
            autoIndent: "full",
          }}
          value={rawJson}
          onChange={(e) => (e ? setRawJson(e) : null)}
        />
      </div>
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>
          <p>Relays</p>
          <div>
            <input
              type="text"
              style={{
                borderRadius: "8px",
                border: "1px solid transparent",
                padding: "0.6em 1.2em",
                fontSize: "1rem",
                marginRight: "0.5rem",
              }}
              value={relayInput}
              onChange={(e) => setRelayInput(e.target.value)}
            />
            <button onClick={addRelay}>Add</button>
          </div>
          <div>
            {relays.map((relay, i) => (
              <div
                key={relay}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <button
                  onClick={() => removeRelay(i)}
                  style={{
                    padding: 0,
                    background: "transparent",
                    color: "#f22",
                    fontSize: "1.5rem",
                  }}
                >
                  ×
                </button>
                <p>{relay}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <input
            id="replace-created-at-checkbox"
            type="checkbox"
            checked={replaceCreatedAt}
            onChange={(e) => setReplaceCreatedAt(e.target.checked)}
          />
          <label htmlFor="replace-created-at-checkbox">
            Replace created_at with current time
          </label>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button disabled={!pubkey} onClick={sign}>
            ✍️ Sign JSON
          </button>
          <button disabled={!pubkey} onClick={signAndPublish}>
            📪 Sign & Publish JSON
          </button>
        </div>
      </div>
      <h2>Signed JSON</h2>
      <Editor
        height="300px"
        defaultLanguage="json"
        theme="vs-dark"
        options={{
          cursorStyle: "line",
          readOnly: true,
        }}
        value={signedJson}
      />
    </div>
  );
}

export default App;
