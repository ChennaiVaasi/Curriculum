import { Feather } from "@expo/vector-icons";
import { useScanChessDiagram } from "@workspace/api-client-react";
import type { ScannedPosition } from "@workspace/api-client-react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChessBoard } from "@/components/ChessBoard";
import { ChessEngine, type ChessEngineHandle } from "@/components/ChessEngine";
import { EvalBar } from "@/components/EvalBar";
import { Badge, Card } from "@/components/common";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import {
  formatEval,
  parseInfoLine,
  sideToMoveFromFen,
  type EngineLine,
} from "@/lib/chessUtils";

const TARGET_DEPTH = 18;
const MULTI_PV = 3;

export default function ChessEyeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const scan = useScanChessDiagram();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [results, setResults] = useState<ScannedPosition[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const [fen, setFen] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  // Engine state
  const engineRef = useRef<ChessEngineHandle>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [lines, setLines] = useState<EngineLine[]>([]);
  const [evalCp, setEvalCp] = useState(0);
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const [depth, setDepth] = useState(0);
  const pendingRef = useRef<Map<number, EngineLine>>(new Map());
  const currentFenRef = useRef<string | null>(null);

  const analyze = useCallback((targetFen: string) => {
    if (!engineRef.current) return;
    currentFenRef.current = targetFen;
    pendingRef.current = new Map();
    setLines([]);
    setDepth(0);
    setEvalCp(0);
    setEvalMate(null);
    setEngineRunning(true);
    engineRef.current.send("stop");
    engineRef.current.send(`setoption name MultiPV value ${MULTI_PV}`);
    engineRef.current.send(`position fen ${targetFen}`);
    engineRef.current.send(`go depth ${TARGET_DEPTH}`);
  }, []);

  // Kick off analysis when a position is chosen and the engine is ready.
  useEffect(() => {
    if (fen && engineReady) analyze(fen);
  }, [fen, engineReady, analyze]);

  const handleLine = useCallback((line: string) => {
    if (line.startsWith("bestmove")) {
      setEngineRunning(false);
      return;
    }
    const cf = currentFenRef.current;
    if (!cf) return;
    const parsed = parseInfoLine(line, cf);
    if (!parsed) return;

    pendingRef.current.set(parsed.multipv, parsed);
    setDepth(parsed.depth);
    if (parsed.multipv === 1) {
      // Engine reports score from side-to-move perspective; normalize to White.
      const stm = sideToMoveFromFen(cf);
      const sign = stm === "w" ? 1 : -1;
      setEvalCp(parsed.eval * sign);
      setEvalMate(parsed.mate === null ? null : parsed.mate * sign);
    }
    const sorted = Array.from(pendingRef.current.values()).sort(
      (a, b) => a.multipv - b.multipv,
    );
    setLines(sorted);
  }, []);

  const pickImage = async (fromCamera: boolean) => {
    setScanError(null);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setScanError(
          fromCamera
            ? "Camera permission is required to capture a diagram."
            : "Photo library permission is required.",
        );
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.8,
          });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setResults([]);
      setFen(null);
      if (!asset.base64) {
        setScanError("Could not read image data. Try another photo.");
        return;
      }
      runScan(asset.base64, asset.mimeType ?? "image/jpeg");
    } catch (e) {
      setScanError(String(e));
    }
  };

  const runScan = (imageBase64: string, mimeType: string) => {
    setScanError(null);
    scan.mutate(
      { data: { imageBase64, mimeType } },
      {
        onSuccess: (res) => {
          setResults(res.positions);
          if (res.positions.length === 1) setFen(res.positions[0].fen);
          if (res.positions.length === 0) {
            setScanError("No chess diagram detected. Try a clearer photo.");
          }
        },
        onError: (err) => setScanError(String(err)),
      },
    );
  };

  const boardSize = Math.min(width - 32 - 30, 360);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 120,
        gap: 16,
      }}
    >
      {/* Hidden Stockfish engine */}
      <ChessEngine
        ref={engineRef}
        onReady={() => setEngineReady(true)}
        onLine={handleLine}
      />

      <View>
        <View style={styles.titleRow}>
          <Feather name="eye" size={24} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Chess Eye
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Snap a chess diagram and let the engine analyze it.
        </Text>
      </View>

      {/* Capture buttons */}
      <View style={styles.captureRow}>
        <Pressable
          style={[styles.captureBtn, { backgroundColor: colors.primary }]}
          onPress={() => pickImage(true)}
        >
          <Feather name="camera" size={18} color="#fff" />
          <Text style={styles.captureText}>Capture</Text>
        </Pressable>
        <Pressable
          style={[
            styles.captureBtn,
            {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          onPress={() => pickImage(false)}
        >
          <Feather name="image" size={18} color={colors.primary} />
          <Text style={[styles.captureText, { color: colors.primary }]}>
            Upload
          </Text>
        </Pressable>
      </View>

      {imageUri ? (
        <Card style={{ alignItems: "center", gap: 10 }}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.preview, { borderColor: colors.border }]}
            contentFit="contain"
          />
          {scan.isPending ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                Recognizing position…
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {scanError ? (
        <Card
          style={{
            borderColor: colors.destructive,
            backgroundColor: "#fdecec",
          }}
        >
          <Text style={{ color: colors.destructive, fontFamily: fonts.body }}>
            {scanError}
          </Text>
        </Card>
      ) : null}

      {/* Scan results selector */}
      {results.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.section, { color: colors.foreground }]}>
            {results.length} positions found
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {results.map((p, idx) => {
              const active = fen === p.fen;
              return (
                <Pressable key={idx} onPress={() => setFen(p.fen)}>
                  <View
                    style={[
                      styles.resultCard,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <ChessBoard fen={p.fen} size={110} />
                    <Text
                      style={[styles.resultMeta, { color: colors.mutedForeground }]}
                    >
                      {p.sideToMove === "b" ? "Black" : "White"} to move ·{" "}
                      {Math.round((p.confidence ?? 0) * 100)}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Analysis board */}
      {fen ? (
        <View style={{ gap: 12 }}>
          <View style={styles.boardRow}>
            <EvalBar cp={evalCp} mate={evalMate} height={boardSize} />
            <ChessBoard fen={fen} size={boardSize} flipped={flipped} />
          </View>

          <View style={styles.controlsRow}>
            <View style={styles.evalChip}>
              <Text style={[styles.evalValue, { color: colors.foreground }]}>
                {formatEval(evalCp, evalMate)}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {sideToMoveFromFen(fen) === "b" ? "Black" : "White"} to move
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              style={[styles.iconBtn, { borderColor: colors.border }]}
              onPress={() => setFlipped((f) => !f)}
            >
              <Feather name="repeat" size={16} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { borderColor: colors.border }]}
              onPress={() => analyze(fen)}
            >
              <Feather name="refresh-cw" size={16} color={colors.foreground} />
            </Pressable>
          </View>

          <Card style={{ gap: 10 }}>
            <View style={styles.engineHead}>
              <Text style={[styles.engineTitle, { color: colors.foreground }]}>
                Stockfish
              </Text>
              {!engineReady ? (
                <Badge label="Loading engine…" tone="muted" />
              ) : engineRunning ? (
                <View style={styles.runningRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    depth {depth}
                  </Text>
                </View>
              ) : (
                <Badge label={`depth ${depth}`} tone="muted" />
              )}
            </View>

            {lines.length === 0 ? (
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {engineReady ? "Calculating…" : "Engine is starting up…"}
              </Text>
            ) : (
              lines.map((l) => (
                <View key={l.multipv} style={styles.lineRow}>
                  <Text style={[styles.lineEval, { color: colors.primary }]}>
                    {formatEval(
                      l.eval * (sideToMoveFromFen(fen) === "w" ? 1 : -1),
                      l.mate === null
                        ? null
                        : l.mate * (sideToMoveFromFen(fen) === "w" ? 1 : -1),
                    )}
                  </Text>
                  <Text
                    style={[styles.lineMoves, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {l.san.join(" ")}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>
      ) : !imageUri ? (
        <Card style={{ alignItems: "center", gap: 8, paddingVertical: 30 }}>
          <Feather name="camera" size={34} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No diagram yet
          </Text>
          <Text
            style={[
              styles.meta,
              { color: colors.mutedForeground, textAlign: "center" },
            ]}
          >
            Capture or upload a photo of a chess diagram to get started.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    marginTop: 4,
  },
  captureRow: {
    flexDirection: "row",
    gap: 12,
  },
  captureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  captureText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
  },
  scanning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meta: {
    fontSize: 13,
    fontFamily: fonts.body,
  },
  section: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
  },
  resultCard: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 8,
    gap: 6,
    alignItems: "center",
  },
  resultMeta: {
    fontSize: 11,
    fontFamily: fonts.body,
  },
  boardRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  evalChip: {
    gap: 2,
  },
  evalValue: {
    fontSize: 22,
    fontFamily: fonts.bodyBold,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  engineHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  engineTitle: {
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
  },
  runningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lineEval: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    width: 48,
  },
  lineMoves: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
  },
});
