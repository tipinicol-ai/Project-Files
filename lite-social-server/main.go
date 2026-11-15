package main

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed assets/*
var embeddedAssets embed.FS

type Comment struct {
	User, Text string
	At         time.Time
}
type Post struct {
	ID, File, Caption, Author string
	Reactions                 map[string]int
	Comments                  []Comment
	At                        time.Time
}
type Profile struct{ Game string }
type State struct {
	Users    map[string]string
	Posts    map[string]Post
	Profiles map[string]Profile
}

var mu sync.Mutex
var dataDir, filesDir, publicURL string
var state = State{Users: map[string]string{}, Posts: map[string]Post{}, Profiles: map[string]Profile{}}
var reactions = []struct{ Key, Emoji, Label string }{{"fire", "🔥", "FUEGO"}, {"crit", "⚡", "CRIT"}, {"gg", "👍", "GG"}, {"heart", "❤️", "LOVE"}, {"lol", "😂", "LOL"}, {"wow", "😮", "WOW"}, {"ko", "😡", "KO"}}

func main() {
	base, _ := os.UserConfigDir()
	dataDir = filepath.Join(base, "Project Files Social Server Lite")
	filesDir = filepath.Join(dataDir, "files")
	_ = os.MkdirAll(filesDir, 0755)
	load()
	http.Handle("/assets/", http.FileServer(http.FS(embeddedAssets)))
	http.HandleFunc("/", home)
	http.HandleFunc("/login", login)
	http.HandleFunc("/register", register)
	http.HandleFunc("/logout", logout)
	http.HandleFunc("/upload", upload)
	http.HandleFunc("/react", react)
	http.HandleFunc("/comment", comment)
	http.HandleFunc("/media/", media)
	http.HandleFunc("/admin", admin)
	http.HandleFunc("/profile", profile)
	http.HandleFunc("/delete", deletePost)
	port := "8787"
	if p := os.Getenv("PROJECT_FILES_PORT"); p != "" {
		port = p
	}
	url := "http://127.0.0.1:" + port
	ip := detectIP()
	publicURL = "http://" + ip + ":" + port
	log.Printf("==============================================")
	log.Printf(" PROJECT FILES SOCIAL SERVER LITE")
	log.Printf("==============================================")
	log.Printf("Estado: servidor social activo")
	log.Printf("Direccion web local: %s", publicURL)
	log.Printf("Solo este PC: %s", url)
	log.Printf("Panel admin: %s/admin", url)
	log.Printf("Datos guardados en: %s", dataDir)
	log.Printf("Abre la direccion manualmente; el navegador no se abrira solo.")
	log.Printf("Pulsa Ctrl+C para detener el servidor.")
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func detectIP() string {
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && ip.To4() != nil {
				return ip.String()
			}
		}
	}
	return "127.0.0.1"
}

func hash(s string) string { b := sha256.Sum256([]byte(s)); return hex.EncodeToString(b[:]) }

func load() {
	b, e := os.ReadFile(filepath.Join(dataDir, "state.json"))
	if e == nil {
		_ = json.Unmarshal(b, &state)
	}
	if state.Users == nil {
		state.Users = map[string]string{}
	}
	if state.Posts == nil {
		state.Posts = map[string]Post{}
	}
	if state.Profiles == nil {
		state.Profiles = map[string]Profile{}
	}
}

func save() {
	b, _ := json.MarshalIndent(state, "", "  ")
	_ = os.WriteFile(filepath.Join(dataDir, "state.json"), b, 0644)
}

func user(r *http.Request) string {
	c, e := r.Cookie("pf_user")
	if e != nil {
		return ""
	}
	return c.Value
}

func redirect(w http.ResponseWriter, r *http.Request, to string) {
	http.Redirect(w, r, to, http.StatusSeeOther)
}

func layout(title, body string) string {
	doc := `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061722"><title>{{TITLE}} · Gamer Community</title><link rel="stylesheet" href="/assets/lite-social.css"></head><body>{{BODY}}</body></html>`
	return strings.NewReplacer("{{TITLE}}", template.HTMLEscapeString(title), "{{BODY}}", body).Replace(doc)
}

func home(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		auth(w, "login", "")
		return
	}
	mu.Lock()
	posts := make([]Post, 0, len(state.Posts))
	for _, p := range state.Posts {
		posts = append(posts, p)
	}
	game := state.Profiles[u].Game
	mu.Unlock()
	sort.Slice(posts, func(i, j int) bool { return posts[i].At.After(posts[j].At) })
	initial := "P"
	if u != "" {
		initial = strings.ToUpper(string([]rune(u)[0]))
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<header class="community-header"><img class="community-banner" src="/assets/community-banner.webp" alt="Gamer Community — Tu nexo de juego local"><details class="profile"><summary aria-label="Mi perfil"><span class="sr-only">Abrir mi perfil</span></summary><section class="profile-menu"><div class="profile-heading"><span class="avatar">%s</span><div><strong>%s</strong><small>Mi perfil</small></div></div><form method="post" action="/profile"><label>Juego que juegas<input name="game" value="%s" maxlength="80" placeholder="Ej. Dota 2"></label><button class="btn profile-save">Guardar perfil</button></form><a class="profile-link" href="/admin">Consola de administración</a><a class="profile-link logout-link" href="/logout">Cerrar sesión</a></section></details></header>`, template.HTMLEscapeString(initial), template.HTMLEscapeString(u), template.HTMLEscapeString(game)))
	b.WriteString(fmt.Sprintf(`<main class="feed"><section class="composer neon-frame"><div class="avatar composer-avatar">%s</div><form action="/upload" method="post" enctype="multipart/form-data"><input name="caption" placeholder="¿Qué estás pensando hoy?" maxlength="2000" aria-label="Texto de la publicación"><label class="media-button"><span>▧ Añadir foto / vídeo</span><input type="file" name="file" accept="image/*,video/mp4,video/webm,video/ogg,.mp4,.m4v,.webm,.ogv,.ogg,.pdf,.zip" required></label><button class="btn publish-button">Publicar</button></form></section>`, template.HTMLEscapeString(initial)))
	for _, p := range posts {
		fileURL := "/media/" + url.PathEscape(p.File)
		b.WriteString(`<article class="post neon-frame"><header class="post-header"><div class="post-author"><span class="avatar post-avatar">` + template.HTMLEscapeString(strings.ToUpper(firstRune(p.Author))) + `</span><div><strong>` + template.HTMLEscapeString(p.Author) + `</strong><small>` + p.At.Format("02/01/2006") + `</small></div></div>`)
		if p.Author == u {
			b.WriteString(`<form method="post" action="/delete" onsubmit="return confirm('¿Eliminar esta publicación?')"><input type="hidden" name="id" value="` + template.HTMLEscapeString(p.ID) + `"><button class="delete" aria-label="Eliminar publicación">•••</button></form>`)
		}
		b.WriteString(`</header>`)
		if p.Caption != "" {
			b.WriteString(`<p class="caption">` + template.HTMLEscapeString(p.Caption) + `</p>`)
		}
		ext := strings.ToLower(filepath.Ext(p.File))
		if isVideoFile(ext) {
			b.WriteString(`<video class="media" controls playsinline preload="metadata" aria-label="Video publicado"><source src="` + template.HTMLEscapeString(fileURL) + `" type="` + template.HTMLEscapeString(videoContentType(ext)) + `">Tu navegador no puede reproducir este formato. Prueba con MP4 (H.264) o WebM.</video><p class="media-error" hidden>No se pudo reproducir este video. Usa MP4 (H.264) o WebM.</p>`)
		} else if strings.HasPrefix(mime.TypeByExtension(ext), "image/") {
			b.WriteString(`<img class="media" src="` + template.HTMLEscapeString(fileURL) + `" alt="Imagen publicada" loading="lazy">`)
		} else {
			b.WriteString(`<p class="file-link">Archivo: <a href="` + template.HTMLEscapeString(fileURL) + `">` + template.HTMLEscapeString(p.File) + `</a></p>`)
		}
		b.WriteString(`<div class="reactions">`)
		for _, x := range reactions {
			b.WriteString(fmt.Sprintf(`<form method="post" action="/react"><input type="hidden" name="id" value="%s"><input type="hidden" name="key" value="%s"><button class="reaction" title="%s"><span>%s</span><em>%d</em></button></form>`, template.HTMLEscapeString(p.ID), x.Key, x.Label, x.Emoji, p.Reactions[x.Key]))
		}
		b.WriteString(`</div><div class="comments">`)
		for _, c := range p.Comments {
			b.WriteString(`<div class="comment"><b>` + template.HTMLEscapeString(c.User) + `</b>` + template.HTMLEscapeString(c.Text) + `</div>`)
		}
		b.WriteString(`<form class="comment-form" method="post" action="/comment"><input type="hidden" name="id" value="` + template.HTMLEscapeString(p.ID) + `"><input name="text" maxlength="2000" required placeholder="Escribe un comentario..."><button class="btn comment-button">Publicar</button></form></div></article>`)
	}
	b.WriteString(`<footer class="feed-footer">Gamer Community · Tu nexo de juego local</footer></main><script>document.addEventListener('error',function(e){if(e.target instanceof HTMLVideoElement){var n=e.target.nextElementSibling;if(n)n.hidden=false}},true)</script>`)
	fmt.Fprint(w, layout("Gamer Community", b.String()))
}

func firstRune(s string) string {
	r := []rune(s)
	if len(r) == 0 {
		return "P"
	}
	return string(r[0])
}

func auth(w http.ResponseWriter, mode, msg string) {
	registering := mode == "register"
	title, action, subtitle, banner, foot := "Iniciar sesión", "/login", "Accede a tu cuenta universal", "/assets/login-banner.jpg", `<a href="/register">Crear una cuenta nueva</a>`
	if registering {
		title, action, subtitle, banner, foot = "Crear cuenta", "/register", "Regístrate para unirte a la partida.", "/assets/register-banner.webp", `<a href="/login">Ya tengo cuenta</a>`
	}
	message := ""
	if msg != "" {
		message = `<p class="error">` + template.HTMLEscapeString(msg) + `</p>`
	}
	userPlaceholder := "Usuario o correo"
	passwordAutocomplete := "current-password"
	if registering {
		userPlaceholder = "Usuario"
		passwordAutocomplete = "new-password"
	}
	body := fmt.Sprintf(`<main class="auth-page"><img class="auth-banner" src="%s" alt="Gamer Community — Tu nexo de juego local"><section class="auth-card"><h1>%s</h1><p class="auth-subtitle">%s</p>%s<form class="auth-form" method="post" action="%s"><label class="auth-field player-field"><span aria-hidden="true">♧</span><input name="user" minlength="3" maxlength="40" placeholder="%s" autocomplete="username" required></label><label class="auth-field key-field"><span aria-hidden="true">⚿</span><input type="password" name="pass" minlength="6" placeholder="Contraseña" autocomplete="%s" required></label><button class="btn auth-submit">%s</button></form><p class="auth-footer">%s</p></section></main>`, banner, title, subtitle, message, action, userPlaceholder, passwordAutocomplete, title, foot)
	fmt.Fprint(w, layout(title, body))
}

func login(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		auth(w, "login", "")
		return
	}
	_ = r.ParseForm()
	u := strings.ToLower(strings.TrimSpace(r.FormValue("user")))
	mu.Lock()
	ok := state.Users[u] == hash(r.FormValue("pass"))
	mu.Unlock()
	if !ok {
		auth(w, "login", "Usuario o contraseña incorrectos")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: u, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	redirect(w, r, "/")
}

func register(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		auth(w, "register", "")
		return
	}
	_ = r.ParseForm()
	u := strings.ToLower(strings.TrimSpace(r.FormValue("user")))
	mu.Lock()
	defer mu.Unlock()
	if len(u) < 3 || len(r.FormValue("pass")) < 6 || state.Users[u] != "" {
		auth(w, "register", "Usuario inválido o ya existente")
		return
	}
	state.Users[u] = hash(r.FormValue("pass"))
	save()
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: u, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	redirect(w, r, "/")
}

func logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: "", MaxAge: -1, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	redirect(w, r, "/")
}

func upload(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		redirect(w, r, "/")
		return
	}
	_ = r.ParseMultipartForm(500 << 20)
	f, h, e := r.FormFile("file")
	if e != nil {
		redirect(w, r, "/")
		return
	}
	defer f.Close()
	originalName := strings.ReplaceAll(h.Filename, `\`, "/")
	name := fmt.Sprintf("%d-%s", time.Now().UnixNano(), filepath.Base(originalName))
	out, e := os.Create(filepath.Join(filesDir, name))
	if e != nil {
		http.Error(w, "No se pudo guardar el archivo", http.StatusInternalServerError)
		return
	}
	if _, e = io.Copy(out, f); e != nil {
		_ = out.Close()
		_ = os.Remove(filepath.Join(filesDir, name))
		http.Error(w, "No se pudo guardar el archivo", http.StatusInternalServerError)
		return
	}
	_ = out.Close()
	p := Post{ID: name, File: name, Caption: r.FormValue("caption"), Author: u, Reactions: map[string]int{}, At: time.Now()}
	mu.Lock()
	state.Posts[name] = p
	save()
	mu.Unlock()
	redirect(w, r, "/")
}

func profile(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		redirect(w, r, "/")
		return
	}
	_ = r.ParseForm()
	mu.Lock()
	state.Profiles[u] = Profile{Game: strings.TrimSpace(r.FormValue("game"))}
	save()
	mu.Unlock()
	redirect(w, r, "/")
}

func deletePost(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	id := r.FormValue("id")
	mu.Lock()
	p, ok := state.Posts[id]
	if ok && p.Author == u {
		delete(state.Posts, id)
		_ = os.Remove(filepath.Join(filesDir, p.File))
		save()
	}
	mu.Unlock()
	redirect(w, r, "/")
}

func react(w http.ResponseWriter, r *http.Request) {
	if user(r) == "" {
		redirect(w, r, "/")
		return
	}
	mu.Lock()
	p := state.Posts[r.FormValue("id")]
	if p.Reactions == nil {
		p.Reactions = map[string]int{}
	}
	for _, x := range reactions {
		if x.Key == r.FormValue("key") {
			p.Reactions[x.Key]++
		}
	}
	state.Posts[p.ID] = p
	save()
	mu.Unlock()
	redirect(w, r, "/")
}

func comment(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	mu.Lock()
	p := state.Posts[r.FormValue("id")]
	p.Comments = append(p.Comments, Comment{User: u, Text: r.FormValue("text"), At: time.Now()})
	state.Posts[p.ID] = p
	save()
	mu.Unlock()
	redirect(w, r, "/")
}

func isVideoFile(ext string) bool {
	return videoContentType(ext) != ""
}

func videoContentType(ext string) string {
	switch strings.ToLower(ext) {
	case ".mp4", ".m4v":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".ogv", ".ogg":
		return "video/ogg"
	case ".mov":
		return "video/quicktime"
	default:
		return ""
	}
}

func media(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(strings.TrimPrefix(r.URL.Path, "/media/"))
	if name == "." || name == "/" || name == "" {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(filesDir, name)
	f, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	ext := strings.ToLower(filepath.Ext(name))
	contentType := videoContentType(ext)
	if contentType == "" {
		contentType = mime.TypeByExtension(ext)
	}
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, info.ModTime(), f)
}

func admin(w http.ResponseWriter, r *http.Request) {
	if user(r) == "" {
		auth(w, "login", "")
		return
	}
	mu.Lock()
	postCount, userCount := len(state.Posts), len(state.Users)
	mu.Unlock()
	body := fmt.Sprintf(`<header class="admin-header"><a href="/"><img src="/assets/community-banner.webp" alt="Gamer Community"></a></header><main class="feed admin-page"><section class="post admin-card"><h1>Consola de administración</h1><p>Servidor social Project Files Social Server Lite</p><p class="url">%s</p><p>Publicaciones: %d · Usuarios: %d</p><a class="profile-link" href="/">Volver a la comunidad</a><a class="profile-link logout-link" href="/logout">Cerrar sesión</a></section></main>`, template.HTMLEscapeString(publicURL), postCount, userCount)
	fmt.Fprint(w, layout("Administración", body))
}
