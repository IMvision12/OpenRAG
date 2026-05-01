import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./lib/api";
import { DEFAULT_CONFIG, type PipelineConfig, type Presets } from "./lib/types";
import { Header } from "./components/Header";
import { Stepper } from "./components/Stepper";
import { Banner } from "./components/Banner";
import { HomePage } from "./pages/Home";
import { ConfigurationPage } from "./pages/Configuration";
import { ModelsPage } from "./pages/Models";
import { DocumentsPage } from "./pages/Documents";
import { ChatPage } from "./pages/Chat";

const STEPS = ["Configuration", "Models", "Documents", "Chat"];

type View = { kind: "home" } | { kind: "wizard"; step: number };

export default function App() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: "home" });
  const [config, setConfig] = useState<PipelineConfig>(DEFAULT_CONFIG);
  const [pipelineActive, setPipelineActive] = useState(false);
  // Tracks whether at least one successful ingest has happened in this
  // browser session. Gates "Continue → Chat" on the Documents page and
  // the Stepper's jump-to-Chat affordance, so users can't reach the
  // chat surface with an empty index.
  const [hasIngested, setHasIngested] = useState(false);

  const presetsQ = useQuery<Presets>({
    queryKey: ["presets"],
    queryFn: api.getPresets,
    staleTime: Infinity,
  });
  const configQ = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  useEffect(() => {
    if (configQ.data) {
      setConfig(configQ.data.config);
      setPipelineActive(configQ.data.pipeline_active);
    }
  }, [configQ.data]);

  const putConfig = useMutation({
    mutationFn: (cfg: PipelineConfig) => api.putConfig(cfg),
    onSuccess: (data) => {
      setPipelineActive(data.pipeline_active);
      qc.invalidateQueries({ queryKey: ["config"] });
    },
  });

  const reset = useMutation({
    mutationFn: () => api.reset(),
    onSuccess: () => {
      setConfig(DEFAULT_CONFIG);
      setPipelineActive(false);
      setHasIngested(false);
      setView({ kind: "home" });
      qc.invalidateQueries({ queryKey: ["config"] });
    },
  });

  const onConfigChange = useCallback(
    (patch: Partial<PipelineConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        putConfig.mutate(next);
        return next;
      });
    },
    [putConfig],
  );

  const goStep = (step: number) => setView({ kind: "wizard", step });
  const goHome = () => setView({ kind: "home" });

  const currentStep = view.kind === "wizard" ? view.step : 0;

  const canJump = (n: number) => {
    if (n <= currentStep) return true;
    if (n === 2) return !!config.backend;
    if (n === 3)
      return (
        !!config.backend &&
        !!config.llm_provider &&
        (config.llm_provider === "ollama"
          ? !!config.ollama_model
          : !!config.hf_model)
      );
    // Step 4 (Chat) requires at least one successful ingest. Empty-index
    // chats produce confusing "no chunks found" results — better to keep
    // the user on Documents until they've actually loaded something.
    if (n === 4) return hasIngested;
    return true;
  };

  if (view.kind === "home") {
    return (
      <div className="min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Header
            config={config}
            pipelineActive={pipelineActive}
            onReset={() => reset.mutate()}
            onLogoClick={goHome}
            compact
          />
        </div>
        <div className="max-w-5xl mx-auto px-6">
          <HomePage onStart={() => goStep(1)} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <Header
        config={config}
        pipelineActive={pipelineActive}
        onReset={() => reset.mutate()}
        onLogoClick={goHome}
      />

      <Stepper
        current={currentStep}
        steps={STEPS}
        onJump={goStep}
        canJump={canJump}
      />

      {presetsQ.isLoading && (
        <Banner tone="info">Loading presets…</Banner>
      )}
      {presetsQ.isError && (
        <Banner tone="error">
          Failed to reach the API on /api/presets — is the FastAPI backend
          running on :8000?
        </Banner>
      )}

      {presetsQ.data && (
        <main className="fade-in" key={currentStep}>
          {currentStep === 1 && (
            <ConfigurationPage
              config={config}
              onChange={onConfigChange}
              onNext={() => goStep(2)}
            />
          )}
          {currentStep === 2 && (
            <ModelsPage
              config={config}
              presets={presetsQ.data}
              onChange={onConfigChange}
              onBack={() => goStep(1)}
              onNext={() => goStep(3)}
            />
          )}
          {currentStep === 3 && (
            <DocumentsPage
              hasIngested={hasIngested}
              onIngestComplete={() => setHasIngested(true)}
              onBack={() => goStep(2)}
              onNext={() => goStep(4)}
            />
          )}
          {currentStep === 4 && <ChatPage onBack={() => goStep(3)} />}
        </main>
      )}
    </div>
  );
}
