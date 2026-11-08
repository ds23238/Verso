import { useEffect, useRef, useState } from "react";
import type { Request, Result } from "./engine";
import { LatestQueue } from "./queue";
export function useConversion(input: Omit<Request, "id">, retry: number) {
  const [result, setResult] = useState<Result>();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  const signature = JSON.stringify({ ...input, retry });
  const [resultSignature, setResultSignature] = useState("");
  const submitted = useRef({ id: 0, signature: "" });
  const revision = useRef(0);
  const queue = useRef<LatestQueue<Request> | null>(null);
  useEffect(() => {
    let disposed = false;
    setPhase("loading");
    setFailure("");
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    queue.current = new LatestQueue((request) =>
      worker.postMessage({ type: "convert", request }),
    );
    worker.onmessage = (event) => {
      if (disposed) return;
      if (event.data.type === "ready") setPhase("ready");
      if (event.data.type === "failure") {
        setPhase("error");
        setFailure(event.data.message);
        setPending(false);
      }
      if (event.data.type === "result") {
        const response = event.data.result as Result;
        if (response.id === revision.current) {
          setResult(response);
          setResultSignature(submitted.current.signature);
          setPending(false);
        }
        queue.current?.complete();
      }
    };
    worker.onerror = () => {
      if (disposed) return;
      setPhase("error");
      setFailure(
        "Konverter konnte nicht geladen werden. Bitte erneut versuchen.",
      );
      setPending(false);
    };
    worker.postMessage({
      type: "init",
      base: new URL(import.meta.env.BASE_URL, document.baseURI).href,
    });
    return () => {
      disposed = true;
      queue.current = null;
      worker.terminate();
    };
  }, [retry]);
  useEffect(() => {
    const id = ++revision.current;
    setPending(true);
    const timer = setTimeout(() => {
      submitted.current = { id, signature };
      queue.current?.submit({ ...input, id });
    }, 200);
    return () => clearTimeout(timer);
  }, [signature]);
  const outdated = resultSignature !== signature;
  return {
    result,
    phase,
    failure,
    pending: pending || outdated,
    current:
      !pending && !outdated && phase === "ready" && Boolean(result?.valid),
  };
}
