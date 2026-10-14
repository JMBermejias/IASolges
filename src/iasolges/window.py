"""
IASolges - Ventana nativa de escritorio (GTK 3 + WebKit2)

Permite ejecutar IASolges como aplicacion de escritorio real, sin depender
del navegador. Si WebKitGTK no esta disponible, el lanzador recurre al
navegador del sistema.
"""
import os

# Errores que GI lanza cuando falta la typelib.
try:
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("Gdk", "3.0")
    from gi.repository import Gtk, GLib
    _GTK = True
except (ImportError, ValueError):
    Gtk = None
    GLib = None
    _GTK = False


def disponible():
    """True si se puede crear una ventana nativa."""
    if not _GTK:
        return False
    return _cargar_webkit() is not None


def _cargar_webkit():
    """Carga los bindings de WebKit, probando 4.1 y luego 6.0."""
    for ns, ver in (("WebKit2", "4.1"), ("WebKit", "6.0")):
        try:
            gi.require_version(ns, ver)
            mod = __import__("gi.repository", fromlist=[ns])
            webkit = getattr(mod, ns)
            if hasattr(webkit, "WebContext"):
                return webkit
        except (ImportError, ValueError, AttributeError):
            continue
    return None


class Ventana:
    """Ventana de aplicacion que muestra la interfaz local de IASolges."""

    def __init__(self, url, titulo="IASolges", ancho=1400, alto=900, al_cerrar=None):
        self.url = url
        self.titulo = titulo
        self.ancho, self.alto = ancho, alto
        self.al_cerrar = al_cerrar
        self.win = None
        self.webkit = _cargar_webkit()
        if self.webkit is None or Gtk is None:
            raise RuntimeError("WebKitGTK no disponible en este sistema")

    # ------------------------------------------------------------------
    def _crear_view(self):
        """
        Crea la vista web. La API cambio entre versiones:
          - WebKit2 4.1 / WebKit 6.0: WebView() + load_uri()
          - WebKit2 4.0 (obsoleto):     WebContext.new_webkit_view()
        Se prueban en orden y se usa la primera que exista.
        """
        wk = self.webkit
        if hasattr(wk, "WebView"):
            return wk.WebView()
        ctx = wk.WebContext.get_default()
        if hasattr(ctx, "new_webkit_view"):
            return ctx.new_webkit_view()
        raise RuntimeError("API de WebKit no reconocida")

    def _configurar(self, view):
        """Ajustes de renderizado: importante para que la app se vea bien."""
        try:
            s = view.get_settings()
            ajustes = {
                "enable-developer-extras": True,
                "enable-write-console-messages-to-stdout": False,
                "enable-smooth-scrolling": True,
                "enable-back-forward-navigation-gestures": False,
                "hardware-acceleration-policy": 1,
            }
            for k, v in ajustes.items():
                try:
                    s.set_property(k, v)
                except (TypeError, AttributeError):
                    pass
        except AttributeError:
            pass

    def _cargar(self, view):
        view.load_uri(self.url)

    # ------------------------------------------------------------------
    def mostrar(self):
        Gtk.Window.set_default_icon_name("iasolges")
        win = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
        win.set_title(self.titulo)
        win.set_default_size(self.ancho, self.alto)
        win.set_size_request(900, 620)
        win.set_position(Gtk.WindowPosition.CENTER)

        view = self._crear_view()
        self._configurar(view)
        view.load_uri(self.url)

        sw = Gtk.ScrolledWindow()
        sw.add(view)
        win.add(sw)

        def al_cerrar(*_):
            if self.al_cerrar:
                self.al_cerrar()
            Gtk.main_quit()

        win.connect("destroy", al_cerrar)
        win.show_all()
        # Arranca maximizada, ocupando toda la pantalla del escritorio.
        try:
            win.maximize()
        except Exception:                                      # noqa: BLE001
            pass
        self.win = win
        return win

    def ejecutar(self):
        """Muestra la ventana y entra en el bucle GTK (bloqueante)."""
        self.mostrar()
        Gtk.main()