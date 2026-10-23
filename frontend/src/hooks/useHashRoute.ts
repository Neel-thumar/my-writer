import { useCallback, useEffect, useState } from "react";

/** App pages, encoded in the URL hash so Back/Forward and refresh work. */
export type Route =
  | { page: "home" }
  | { page: "folder"; id: number }
  | { page: "trash" }
  | { page: "doc"; id: number };

function parse(hash: string): Route {
  const [, page, id] = hash.replace(/^#/, "").split("/");
  const num = Number(id);
  if (page === "doc" && num > 0) return { page: "doc", id: num };
  if (page === "folder" && num > 0) return { page: "folder", id: num };
  if (page === "trash") return { page: "trash" };
  return { page: "home" };
}

export function routeHref(route: Route): string {
  switch (route.page) {
    case "doc":
      return `#/doc/${route.id}`;
    case "folder":
      return `#/folder/${route.id}`;
    case "trash":
      return "#/trash";
    default:
      return "#/";
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: Route) => {
    window.location.hash = routeHref(to);
  }, []);

  return { route, navigate };
}
