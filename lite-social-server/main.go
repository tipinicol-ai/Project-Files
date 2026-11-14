package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

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
type State struct {
	Users map[string]string
	Posts map[string]Post
}

var mu sync.Mutex
var dataDir, filesDir string
var state = State{Users: map[string]string{}, Posts: map[string]Post{}}
var reactions = []struct{ Key, Emoji, Label string }{{"fire", "🔥", "FUEGO"}, {"crit", "⚡", "CRIT"}, {"gg", "👍", "GG"}, {"heart", "❤️", "LOVE"}, {"lol", "😂", "LOL"}, {"wow", "😮", "WOW"}, {"ko", "😡", "KO"}}

func main() {
	base, _ := os.UserConfigDir()
	dataDir = filepath.Join(base, "Project Files Social Server Lite")
	filesDir = filepath.Join(dataDir, "files")
	_ = os.MkdirAll(filesDir, 0755)
	load()
	http.HandleFunc("/", home)
	http.HandleFunc("/login", login)
	http.HandleFunc("/register", register)
	http.HandleFunc("/logout", logout)
	http.HandleFunc("/upload", upload)
	http.HandleFunc("/react", react)
	http.HandleFunc("/comment", comment)
	http.HandleFunc("/media/", media)
	http.HandleFunc("/admin", admin)
	port := "8787"
	if p := os.Getenv("PROJECT_FILES_PORT"); p != "" {
		port = p
	}
	url := "http://127.0.0.1:" + port
	go func() {
		time.Sleep(350 * time.Millisecond)
		if runtime.GOOS == "windows" {
			_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
		} else {
			_ = exec.Command("xdg-open", url).Start()
		}
		log.Printf("Project Files Social Server Lite: %s", url)
	}()
	log.Printf("Servidor social activo en %s", url)
	log.Fatal(http.ListenAndServe(":"+port, nil))
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
	return fmt.Sprintf(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s · Project Files</title><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80%% 0,#15506a 0,#081321 42%%);color:#e8f4fc;font:14px Segoe UI,Arial,sans-serif}.hero{padding:28px max(20px,calc((100%% - 920px)/2));background:linear-gradient(115deg,#071321dd,#0d4158bb);border-bottom:1px solid #3b6c80;display:flex;justify-content:space-between;align-items:end}.hero h1{margin:0;font-size:25px}.hero p{margin:6px 0 0;color:#99bacb;font-size:12px}.wrap{max-width:920px;margin:24px auto;padding:0 20px}.card{padding:18px;border:1px solid #31506a;border-radius:14px;background:linear-gradient(145deg,#142b40dd,#0f2032dd);box-shadow:0 12px 28px #02070d66;margin-bottom:18px}.composer{display:flex;gap:9px}.avatar{width:40px;height:40px;border-radius:50%%;display:grid;place-items:center;background:#1b5368;border:2px solid #69d7e6;font-weight:800}.composer input,.comment input,.auth input{flex:1;padding:12px 14px;border:1px solid #3b5870;border-radius:23px;background:#0a1726;color:#fff}.btn{border:0;border-radius:9px;padding:10px 14px;background:linear-gradient(135deg,#31a6c8,#286bd3);color:#fff;font-weight:700;cursor:pointer}.post h3{margin:0 0 4px;font-size:14px}.post small{color:#89a7b9}.caption{color:#c7d9e8}.media{width:100%%;max-height:480px;object-fit:contain;border-radius:10px;background:#07111d;margin:12px 0}.reactions{display:flex;flex-wrap:wrap;gap:7px}.reaction{padding:7px 10px;border-radius:18px;border:1px solid #36536d;background:#10283c;color:#e1f0f7;cursor:pointer}.reaction span{font-size:17px}.reaction em{font-style:normal;font-size:10px;color:#9eb8cb}.comments{margin-top:12px}.comment{margin-top:8px;padding:8px 10px;border-left:2px solid #48bad6;background:#0b1a2a}.comment b{color:#72deed;margin-right:5px}.comment-form{display:flex;gap:7px;margin-top:10px}.auth{max-width:420px;margin:60px auto}.auth input{display:block;width:100%%;margin:10px 0;border-radius:7px}.auth .btn{width:100%%}.muted{color:#91aabd;font-size:12px}.toplink{color:#8de7f0;text-decoration:none}.admin{display:grid;grid-template-columns:1fr 1fr;gap:12px}.url{padding:10px;background:#06111d;color:#8ce7f2;border-radius:8px;word-break:break-all}@media(max-width:650px){.admin{grid-template-columns:1fr}.hero{display:block}.hero a{display:block;margin-top:12px}} </style></head><body>%s</body></html>`, template.HTMLEscapeString(title), body)
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
	sort.Slice(posts, func(i, j int) bool { return posts[i].At.After(posts[j].At) })
	mu.Unlock()
	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<header class="hero"><div><h1>Project Files · Comunidad</h1><p>Hola, %s · servidor social local</p></div><a class="toplink" href="/admin">Consola de administración</a></header><main class="wrap"><section class="card composer"><div class="avatar">%s</div><form action="/upload" method="post" enctype="multipart/form-data" style="display:flex;gap:8px;flex:1;align-items:center"><input name="caption" placeholder="¿Qué estás pensando?" maxlength="2000"><input type="file" name="file" required><button class="btn">Publicar</button></form></section>`, template.HTMLEscapeString(u), strings.ToUpper(u[:1])))
	for _, p := range posts {
		b.WriteString(`<article class="card post"><h3>` + template.HTMLEscapeString(p.Author) + `</h3><small>` + p.At.Format("02/01/2006 15:04") + ` · ` + template.HTMLEscapeString(p.File) + `</small>`)
		if p.Caption != "" {
			b.WriteString(`<p class="caption">` + template.HTMLEscapeString(p.Caption) + `</p>`)
		}
		ext := strings.ToLower(filepath.Ext(p.File))
		if ext == ".mp4" || ext == ".webm" || ext == ".mov" {
			b.WriteString(`<video class="media" controls preload="metadata" src="/media/` + template.URLQueryEscaper(p.File) + `"></video>`)
		} else if strings.HasPrefix(mime.TypeByExtension(ext), "image/") {
			b.WriteString(`<img class="media" src="/media/` + template.URLQueryEscaper(p.File) + `">`)
		} else {
			b.WriteString(`<p class="url">Archivo: ` + template.HTMLEscapeString(p.File) + `</p>`)
		}
		b.WriteString(`<div class="reactions">`)
		for _, x := range reactions {
			b.WriteString(fmt.Sprintf(`<form method="post" action="/react"><input type="hidden" name="id" value="%s"><input type="hidden" name="key" value="%s"><button class="reaction" title="%s"><span>%s</span> %s <em>%d</em></button></form>`, template.HTMLEscapeString(p.ID), x.Key, x.Label, x.Emoji, x.Label, p.Reactions[x.Key]))
		}
		b.WriteString(`</div><div class="comments">`)
		for _, c := range p.Comments {
			b.WriteString(`<div class="comment"><b>` + template.HTMLEscapeString(c.User) + `</b>` + template.HTMLEscapeString(c.Text) + `</div>`)
		}
		b.WriteString(`<form class="comment-form" method="post" action="/comment"><input type="hidden" name="id" value="` + template.HTMLEscapeString(p.ID) + `"><input name="text" maxlength="2000" required placeholder="Escribe un comentario..."><button class="btn">Publicar</button></form></div></article>`)
	}
	b.WriteString(`<p class="muted"><a class="toplink" href="/logout">Cerrar sesión</a></p></main>`)
	fmt.Fprint(w, layout("Comunidad", b.String()))
}
func auth(w http.ResponseWriter, mode, msg string) {
	title := "Iniciar sesión"
	action := "/login"
	if mode == "register" {
		title = "Crear cuenta"
		action = "/register"
	}
	fmt.Fprint(w, layout(title, fmt.Sprintf(`<main class="card auth"><h1>%s</h1><p class="muted">Servidor social Project Files ligero.</p><form method="post" action="%s"><input name="user" minlength="3" maxlength="40" placeholder="Usuario" required><input type="password" name="pass" minlength="6" placeholder="Contraseña" required><button class="btn">%s</button></form><p class="muted">%s</p></main>`, title, action, title, func() string {
		if mode == "login" {
			return `<a class="toplink" href="/register">Crear cuenta</a>`
		}
		return `<a class="toplink" href="/">Ya tengo cuenta</a>`
	}())))
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
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: u, Path: "/", HttpOnly: true})
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
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: u, Path: "/", HttpOnly: true})
	redirect(w, r, "/")
}
func logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "pf_user", MaxAge: -1, Path: "/"})
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
	name := fmt.Sprintf("%d-%s", time.Now().UnixNano(), filepath.Base(h.Filename))
	out, _ := os.Create(filepath.Join(filesDir, name))
	io.Copy(out, f)
	out.Close()
	p := Post{ID: name, File: name, Caption: r.FormValue("caption"), Author: u, Reactions: map[string]int{}, At: time.Now()}
	mu.Lock()
	state.Posts[name] = p
	save()
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
func media(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(strings.TrimPrefix(r.URL.Path, "/media/"))
	http.ServeFile(w, r, filepath.Join(filesDir, name))
}
func admin(w http.ResponseWriter, r *http.Request) {
	if user(r) == "" {
		auth(w, "login", "")
		return
	}
	fmt.Fprint(w, layout("Administración", fmt.Sprintf(`<header class="hero"><div><h1>Consola de administración</h1><p>Project Files Social Server Lite</p></div><a class="toplink" href="/">Volver a la web social</a></header><main class="wrap"><section class="card"><h2>Servidor activo</h2><p class="url">http://127.0.0.1:8787</p><p class="muted">Los datos están guardados en:</p><p class="url">%s</p></section><div class="admin"><section class="card"><h2>Herramientas</h2><p class="muted">Publicaciones: %d<br>Usuarios: %d<br>Reacciones gamer estilo Facebook activas.</p></section><section class="card"><h2>Sesión</h2><p class="muted">Administrador: %s</p><a class="btn" href="/logout">Cerrar sesión</a></section></div></main>`, template.HTMLEscapeString(dataDir), len(state.Posts), len(state.Users), template.HTMLEscapeString(user(r)))))
}
