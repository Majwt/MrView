import { useEffect, useState } from "react";
import { fetchNewFeatureData } from "../api/new-feature-api";

export function useNewFeatureData() {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("New Feature");

  useEffect(() => {
    let mounted = true;

    fetchNewFeatureData()
      .then((data) => {
        if (!mounted) {
          return;
        }

        setTitle(data.title);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { loading, title };
}
