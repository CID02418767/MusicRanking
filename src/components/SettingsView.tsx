import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Download, FileUp, HardDrive, RotateCcw, Save } from "lucide-react";
import type { AppData, RatingKey, RatingWeights } from "../types";
import { ratingLabels } from "../types";
import { clampRating, normalizeWeights } from "../lib/scoring";
import { normalizeAppData, STORAGE_KEY } from "../lib/storage";

interface SettingsViewProps {
  data: AppData;
  lastSavedAt: Date | null;
  ratingKeys: RatingKey[];
  onReplaceData: (data: AppData) => void;
  onResetData: () => void;
  onSetWeights: (weights: RatingWeights) => void;
}

function SettingsView({
  data,
  lastSavedAt,
  ratingKeys,
  onReplaceData,
  onResetData,
  onSetWeights,
}: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const totalWeight = useMemo(() => {
    return ratingKeys.reduce((sum, key) => sum + data.weights[key], 0);
  }, [data.weights, ratingKeys]);

  function updateWeight(key: RatingKey, value: number) {
    onSetWeights(normalizeWeights({
      ...data.weights,
      [key]: Math.max(0, value),
    }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `musicranking-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError(null);
    try {
      const text = await file.text();
      onReplaceData(normalizeAppData(JSON.parse(text)));
      event.target.value = "";
    } catch {
      setImportError("JSON 导入失败，请检查备份文件格式。");
    }
  }

  return (
    <section className="view-grid settings-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Weights</p>
            <h2>评分权重</h2>
          </div>
        </div>

        <div className="weight-stack">
          {ratingKeys.map((key) => (
            <label key={key} className="rating-control">
              <span>
                {ratingLabels[key]}
                <strong>{data.weights[key].toFixed(1)}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={data.weights[key]}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => updateWeight(key, clampRating(event.target.value))}
              />
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={data.weights[key]}
                onChange={(event) => updateWeight(key, clampRating(event.target.value))}
              />
            </label>
          ))}
        </div>

        <p className="status-message">
          当前权重总和 {totalWeight.toFixed(1)}。总和为 0 时会自动回退为五项等权。
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Data</p>
            <h2>备份与恢复</h2>
          </div>
          <HardDrive className="muted-icon" size={20} />
        </div>

        <div className="data-stats">
          <div>
            <span>收藏歌曲</span>
            <strong>{data.favorites.length}</strong>
          </div>
          <div>
            <span>缓存条目</span>
            <strong>{Object.keys(data.cache).length}</strong>
          </div>
          <div>
            <span>保存位置</span>
            <strong>{STORAGE_KEY}</strong>
          </div>
          <div>
            <span>最近保存</span>
            <strong>
              {lastSavedAt
                ? lastSavedAt.toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "尚未保存"}
            </strong>
          </div>
        </div>

        <div className="settings-actions">
          <button className="primary-button" type="button" onClick={exportData}>
            <Download size={17} />
            <span>导出 JSON</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={17} />
            <span>导入 JSON</span>
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={() => {
              if (window.confirm("清空所有收藏、评分、权重和缓存？")) {
                onResetData();
              }
            }}
          >
            <RotateCcw size={17} />
            <span>清空本地数据</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          accept="application/json,.json"
          onChange={importData}
        />

        {importError && <p className="status-message error">{importError}</p>}

        <div className="source-note">
          <Save size={17} />
          <p>
            数据只保存在当前浏览器。MusicBrainz 与 Cover Art Archive 结果会缓存，减少重复请求。
          </p>
        </div>
      </section>
    </section>
  );
}

export default SettingsView;
