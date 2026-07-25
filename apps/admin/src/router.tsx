/* eslint-disable react-refresh/only-export-components */
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

type NavigateOptions = { replace?: boolean };
type NavigateFunction = (to: string, options?: NavigateOptions) => void;
type RouteParameters = Record<string, string>;

const NavigationContext = createContext<{
  path: string;
  navigate: NavigateFunction;
} | null>(null);
const ParametersContext = createContext<RouteParameters>({});

const safeTarget = (to: string) => {
  if (!to.startsWith('/') || to.startsWith('//')) return '/';
  try {
    const target = new URL(to, window.location.origin);
    return target.origin === window.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : '/';
  } catch {
    return '/';
  }
};

const currentPath = () => window.location.pathname || '/';

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const handlePopState = () => setPath(currentPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const navigate = useCallback<NavigateFunction>((to, options) => {
    const target = safeTarget(to);
    window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', target);
    setPath(currentPath());
  }, []);
  const value = useMemo(() => ({ path, navigate }), [navigate, path]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('Router components must be rendered inside BrowserRouter.');
  return context;
};

export const useNavigate = () => useNavigation().navigate;
export const useParams = <Parameters extends RouteParameters = RouteParameters>() =>
  useContext(ParametersContext) as Parameters;

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
};

const shouldHandleClick = (event: MouseEvent<HTMLAnchorElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  (!event.currentTarget.target || event.currentTarget.target === '_self');

export function Link({ to, onClick, ...properties }: LinkProps) {
  const { navigate } = useNavigation();
  const target = safeTarget(to);
  return (
    <a
      {...properties}
      href={target}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldHandleClick(event)) return;
        event.preventDefault();
        navigate(target);
      }}
    />
  );
}

export function NavLink({ className, ...properties }: LinkProps) {
  const { path } = useNavigation();
  const targetPath = safeTarget(properties.to).split(/[?#]/, 1)[0] || '/';
  const active = path === targetPath || (targetPath !== '/' && path.startsWith(`${targetPath}/`));
  return (
    <Link
      {...properties}
      className={[className, active ? 'active' : ''].filter(Boolean).join(' ')}
      aria-current={active ? 'page' : undefined}
    />
  );
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useLayoutEffect(() => navigate(to, { replace }), [navigate, replace, to]);
  return null;
}

type RouteProps = {
  path: string;
  element: ReactElement;
};

export function Route(properties: RouteProps) {
  void properties;
  return null;
}

const matchRoute = (pattern: string, path: string): RouteParameters | null => {
  if (pattern === '*') return {};
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const parameters: RouteParameters = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]!;
    const pathPart = pathParts[index]!;
    if (patternPart.startsWith(':')) {
      try {
        parameters[patternPart.slice(1)] = decodeURIComponent(pathPart);
      } catch {
        return null;
      }
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return parameters;
};

export function Routes({ children }: { children: ReactNode }) {
  const { path } = useNavigation();
  for (const child of Children.toArray(children)) {
    if (!isValidElement<RouteProps>(child) || child.type !== Route) continue;
    const parameters = matchRoute(child.props.path, path);
    if (parameters) {
      return (
        <ParametersContext.Provider value={parameters}>
          {child.props.element}
        </ParametersContext.Provider>
      );
    }
  }
  return null;
}
