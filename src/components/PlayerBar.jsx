import { useEffect, useRef } from 'react';
import { formatDuration } from '../lib/loadManifest';

const PREVIEW_CAP_SECONDS = 40;

export default function PlayerBar({
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackMode,
    onPlay,
    onPause,
    onTimeUpdate,
    onDurationChange,
    onSeek,
    onTrackEnd
}) {
    const internalAudioRef = useRef(null);
    const actualRef = audioRef || internalAudioRef;
    const previewTimeoutRef = useRef(null);
    const loadLockRef = useRef(false);
    const webAudioRef = useRef({ ctx: null, source: null, timeoutId: null });
    useEffect(() => {
        const audio = actualRef.current;
        if (!audio || !currentTrack) return;

        // If audio.src already matches the requested track, avoid re-loading to prevent interrupting play
        const currentSrc = audio.src || '';
        const targetSrc = currentTrack.audioUrl || '';
        if (currentSrc === targetSrc || currentSrc.endsWith(targetSrc)) {
            audio.currentTime = 0;
            onTimeUpdate(0);
            const resumePlay = async () => {
                try {
                    if (isPlaying) await audio.play();
                } catch (err) {
                    console.warn('Resume play failed for', targetSrc, err && err.message ? err.message : err);
                }
            };
            resumePlay();
            return;
        }

        // Otherwise set a load lock and update the source atomically
        let cancelled = false;
        const loadAndMaybePlay = async () => {
            if (loadLockRef.current) {
                // wait briefly for other load to finish to avoid racing
                await new Promise(res => setTimeout(res, 150));
            }
            loadLockRef.current = true;
            try {
                // If the target is a .b64 file in public/audio, fetch its content
                // and convert to a data URL so the audio element can play it.
                if (typeof targetSrc === 'string' && targetSrc.endsWith('.b64')) {
                    try {
                        console.debug('[PlayerBar] fetching base64 demo file', targetSrc);
                        const res = await fetch(targetSrc);
                        if (res.ok) {
                            const txt = await res.text();
                            // If the file contains a data: prefix already, use it, else assume raw base64
                            const dataUrl = txt.trim().startsWith('data:') ? txt.trim() : `data:audio/wav;base64,${txt.trim()}`;
                            audio.src = dataUrl;
                            console.debug('[PlayerBar] set src from .b64 ->', targetSrc);
                        } else {
                            console.warn('[PlayerBar] failed to fetch .b64 file', targetSrc, res.status);
                            audio.src = targetSrc; // fallback
                        }
                    } catch (e) {
                        console.warn('[PlayerBar] error fetching .b64 file', targetSrc, e && e.message ? e.message : e);
                        audio.src = targetSrc; // fallback
                    }
                } else {
                    audio.src = targetSrc;
                    console.debug('[PlayerBar] set src ->', targetSrc);
                }
                audio.currentTime = 0;
                onTimeUpdate(0);
                if (typeof audio.load === 'function') audio.load();

                // wait for canplay or timeout
                await new Promise((resolve) => {
                    let resolved = false;
                    const onCan = () => { if (!resolved) { resolved = true; cleanup(); resolve(); } };
                    const cleanup = () => {
                        audio.removeEventListener('canplay', onCan);
                        audio.removeEventListener('canplaythrough', onCan);
                        clearTimeout(timer);
                    };
                    audio.addEventListener('canplay', onCan);
                    audio.addEventListener('canplaythrough', onCan);
                    const timer = setTimeout(() => { if (!resolved) { resolved = true; cleanup(); resolve(); } }, 1000);
                });

                if (cancelled) return;
                                if (isPlaying) {
                                    try {
                                        console.debug('[PlayerBar] attempting play for', targetSrc);
                                        await audio.play();
                                        console.debug('[PlayerBar] play() resolved for', targetSrc);
                                        // If the loaded audio appears non-playable (duration Infinity or 0), start a short tone so user hears feedback
                                        if (!audio.duration || audio.duration === 0 || audio.duration === Infinity) {
                                                startToneFallback(1.8);
                                        }
                                    } catch (err) {
                                        console.warn('Audio play failed after load for', targetSrc, err && err.message ? err.message : err);
                                        // fallback to tone as well
                                        startToneFallback(1.8);
                                    }
                                }
            } finally {
                loadLockRef.current = false;
            }
        };

        loadAndMaybePlay();

        return () => { cancelled = true; };
    }, [currentTrack?.id, actualRef, isPlaying]);

    // Handle audio element setup and playback events (timeupdate, metadata, ended)
    useEffect(() => {
        const audio = actualRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            onTimeUpdate(time);

            // Preview cap logic - only on Product page (preview mode)
            if (playbackMode === 'preview' && time >= PREVIEW_CAP_SECONDS) {
                audio.pause();
                onTrackEnd();
            }
        };

        const handleLoadedMetadata = () => {
                console.debug('[PlayerBar] loadedmetadata', { src: audio.src, duration: audio.duration });
            onDurationChange(audio.duration);
            // If metadata loads but duration is 0, trigger WebAudio fallback
                if (!audio.duration || audio.duration === 0) {
                console.warn('Audio metadata loaded but duration is 0 — using WebAudio fallback');
                try {
                    const ctx = webAudioRef.current.ctx || new (window.AudioContext || window.webkitAudioContext)();
                    webAudioRef.current.ctx = ctx;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = 440;
                    gain.gain.value = 0.02;
                    if (ctx.state === 'suspended') ctx.resume();
                    osc.start();
                    webAudioRef.current.source = osc;
                    const playSeconds = playbackMode === 'preview' ? Math.min(duration || PREVIEW_CAP_SECONDS, PREVIEW_CAP_SECONDS) : (currentTrack?.duration || duration || 30);
                    if (webAudioRef.current.timeoutId) clearTimeout(webAudioRef.current.timeoutId);
                    webAudioRef.current.timeoutId = setTimeout(() => {
                        try { osc.stop(); } catch(e){}
                        webAudioRef.current.timeoutId = null;
                        onTrackEnd();
                    }, playSeconds * 1000);
                } catch (e) {
                    console.warn('WebAudio fallback failed on loadedmetadata', e && e.message ? e.message : e);
                }
            }
        };

        const handleEnded = () => {
            onTrackEnd();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [actualRef, playbackMode, onTimeUpdate, onDurationChange, onTrackEnd]);

    // Helper: start a short audible tone when native audio is non-playable
    const startToneFallback = async (secs = 1.5) => {
        try {
            const ctx = webAudioRef.current.ctx || new (window.AudioContext || window.webkitAudioContext)();
            webAudioRef.current.ctx = ctx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            if (ctx.state === 'suspended') await ctx.resume();
            osc.start();
            webAudioRef.current.source = osc;
            if (webAudioRef.current.timeoutId) clearTimeout(webAudioRef.current.timeoutId);
            webAudioRef.current.timeoutId = setTimeout(() => {
                try { osc.stop(); } catch (e) {}
                webAudioRef.current.timeoutId = null;
                webAudioRef.current.source = null;
                onTrackEnd();
            }, secs * 1000);
            console.debug('[PlayerBar] started tone fallback', { secs });
        } catch (e) {
            console.warn('Tone fallback failed', e && e.message ? e.message : e);
        }
    };

    // Handle play/pause
    useEffect(() => {
        const audio = actualRef.current;
        if (!audio || !currentTrack) return;

        if (isPlaying) {
            console.debug('[PlayerBar] isPlaying changed -> play()', audio.src);
            audio.play().then(() => console.debug('[PlayerBar] play() resolved on isPlaying effect', audio.src)).catch(err => console.error('[PlayerBar] play() error on isPlaying effect', err));
        } else {
            audio.pause();
            // stop any WebAudio fallback
            try {
                const w = webAudioRef.current;
                if (w.source && typeof w.source.stop === 'function') {
                    w.source.stop();
                }
                if (w.timeoutId) {
                    clearTimeout(w.timeoutId);
                    w.timeoutId = null;
                }
            } catch (e) { /* ignore */ }
        }
    }, [isPlaying, currentTrack, actualRef]);

    // NOTE: track loading/play is handled by the primary loader effect above.
    // The separate "handle track change" effect was removed to avoid racing
    // load/play requests which caused AbortError interruptions.

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, []);

    const handleProgressClick = (e) => {
        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const maxDuration = playbackMode === 'preview'
            ? Math.min(duration, PREVIEW_CAP_SECONDS)
            : duration;
        const newTime = percent * maxDuration;
        onSeek(newTime);
    };

    const togglePlayPause = () => {
        if (isPlaying) {
            onPause();
        } else {
            onPlay();
        }
    };

    // Calculate progress
    const maxDuration = playbackMode === 'preview'
        ? Math.min(duration || PREVIEW_CAP_SECONDS, PREVIEW_CAP_SECONDS)
        : duration || 0;
    const progressPercent = maxDuration > 0 ? (currentTime / maxDuration) * 100 : 0;

    return (
        <div className="player-bar">
            <audio ref={actualRef} preload="metadata" />

            <div className="player-controls">
                <button
                    className="player-btn player-btn-play"
                    onClick={togglePlayPause}
                    disabled={!currentTrack}
                >
                    {isPlaying ? '❚❚' : '▶'}
                </button>
            </div>

            <div className="player-progress">
                <div
                    className="player-progress-bar"
                    onClick={handleProgressClick}
                >
                    <div
                        className="player-progress-fill"
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                </div>

                <span className="player-track-name">
                    {currentTrack?.name || '—'}
                </span>

                <span className="player-time">
                    {formatDuration(currentTime)} / {formatDuration(maxDuration)}
                </span>
            </div>
        </div>
    );
}
