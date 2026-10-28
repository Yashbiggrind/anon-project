"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Identicon from "@/components/Identicon";
import type { AvatarDesign } from "@/lib/avatarDesign";
import {
  decodeProfileEditorCode,
  encodeAvatarDesignForProfileEditor,
} from "@/lib/profileEditorCode";

type Props = {
  name: string;
  initialDesign: AvatarDesign | null;
  onSave: (design: AvatarDesign) => void;
  onClose: () => void;
};

export default function ProfileBlockEditor({ name, initialDesign, onSave, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastSavedCode = useRef<string | null>(null);
  const initializedFrame = useRef<HTMLIFrameElement | null>(null);
  const onSaveRef = useRef(onSave);
  const [saved, setSaved] = useState(false);
  const [saveVersion, setSaveVersion] = useState(0);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const close = useCallback(() => onClose(), [onClose]);

  const initializeFrame = useCallback(() => {
    const frame = frameRef.current;
    if (!frame || initializedFrame.current === frame) return;
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.readyState !== "complete") return;
      const codeBox = doc.getElementById("code") as HTMLTextAreaElement | null;
      const loadButton = doc.getElementById("load") as HTMLButtonElement | null;
      const code = encodeAvatarDesignForProfileEditor(initialDesign);
      if (codeBox && loadButton && code) {
        codeBox.value = code;
        loadButton.click();
      }
      initializedFrame.current = frame;
    } catch {
      // Keep the supplied editor unchanged; its own generated starter design still works.
    }
  }, [initialDesign]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);

    const inspectEditor = () => {
      const frame = frameRef.current;
      if (!frame) return;
      try {
        const doc = frame.contentDocument;
        if (!doc) return;

        if (initializedFrame.current !== frame && doc.readyState === "complete") {
          initializeFrame();
        }

        const overlay = doc.getElementById("ov");
        const continueButton = doc.getElementById("ob") as HTMLButtonElement | null;
        const status = doc.getElementById("os");
        const codeBox = doc.getElementById("code") as HTMLTextAreaElement | null;
        const confirmed = overlay?.style.display === "flex" &&
          !!continueButton && continueButton.style.display !== "none" &&
          !!status?.textContent?.includes("IDENTITY CONFIRMED");
        if (!confirmed || !codeBox) return;

        const code = codeBox.value.trim();
        if (!code || code === lastSavedCode.current) return;
        const design = decodeProfileEditorCode(code);
        if (!design) return;

        lastSavedCode.current = code;
        setSaved(true);
        setSaveVersion((value) => value + 1);
        onSaveRef.current(design);
      } catch {
        // Cross-origin restrictions should fail closed; the served same-origin editor is expected.
      }
    };

    const timer = window.setInterval(inspectEditor, 250);
    inspectEditor();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, initializeFrame]);

  return (
    <div className="globalProfileBackdrop" onClick={close}>
      <section
        className="globalProfileDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="globalProfileTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="globalProfileHeading">
          <div className="globalProfileIdentity">
            <div className="globalProfileBigAvatar">
              <Identicon name={name} seed="profile-editor-preview" size={44} />
            </div>
            <div>
              <div className="globalProfileEyebrow">ANON // PERSONAL IDENTITY</div>
              <h2 id="globalProfileTitle">{name}</h2>
              <p>{saved ? "PIXEL PROFILE SAVED FOR THIS SESSION" : "Edit your block avatar. No image uploads."}</p>
            </div>
          </div>
          <button type="button" className="globalProfileClose" onClick={close} aria-label="Close profile editor">×</button>
        </header>

        <div className="globalProfileHint">
          <span className="globalProfileLiveDot" />
          {saved
            ? `Profile updated · revision ${saveVersion} · visible to online users`
            : "Your profile stays anonymous. Confirm your design below to apply it."}
        </div>

        <iframe
          ref={frameRef}
          key="anon-pixel-profile-editor"
          className="globalProfileFrame"
          title="Pixel profile block editor"
          src="/pixel-profile-editor-v2.html"
          onLoad={initializeFrame}
          allow="clipboard-read; clipboard-write"
        />

        <div className="globalProfileBottom">
          <span>PIXEL GRID · SESSION IDENTITY · NO UPLOADS</span>
          <button type="button" onClick={close}>DONE</button>
        </div>
      </section>
    </div>
  );
}
