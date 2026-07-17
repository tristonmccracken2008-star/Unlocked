"use client";

import { useEffect, useState } from "react";
import { advisorProfileUpdatedMessageKey } from "@/data/student-profile";
import styles from "./journey-editorial.module.css";

export function JourneyClientEffects() {
  const [profileUpdateMessage, setProfileUpdateMessage] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth")) {
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const message = localStorage.getItem(advisorProfileUpdatedMessageKey);
    if (message) {
      localStorage.removeItem(advisorProfileUpdatedMessageKey);
      setProfileUpdateMessage(message);
    }
  }, []);
  return profileUpdateMessage ? <p role="status" className={styles.profileUpdateStatus}>{profileUpdateMessage}</p> : null;
}
