CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_table_access_method = heap;

--
-- Name: activos_mapa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activos_mapa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capa character varying NOT NULL,
    categoria character varying NOT NULL,
    region character varying NOT NULL,
    comuna character varying,
    latitud numeric(10,6) NOT NULL,
    longitud numeric(10,6) NOT NULL,
    icono character varying,
    tipo character varying NOT NULL,
    potencial numeric(5,2),
    etiqueta character varying NOT NULL,
    descripcion text,
    fuente_datos character varying,
    visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: capas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    tipo character varying(50),
    color character varying(7),
    icono character varying(50),
    opacidad numeric(3,2) DEFAULT 0.7,
    visible_por_defecto boolean DEFAULT false,
    orden integer DEFAULT 0,
    publico boolean DEFAULT true,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    descripcion text,
    icono character varying(50),
    color character varying(7),
    orden integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: proyectos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proyectos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(300) NOT NULL,
    descripcion text,
    categoria_id uuid,
    region_id uuid,
    geometria_tipo character varying(20),
    latitud numeric(10,6) NOT NULL,
    longitud numeric(10,6) NOT NULL,
    elevacion numeric(10,2),
    estado character varying(50),
    fecha_inicio date,
    inversion_usd numeric(15,2),
    empresa_operadora character varying(300),
    contacto_email character varying(200),
    sitio_web character varying(500),
    visible boolean DEFAULT true,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT proyectos_estado_check CHECK (((estado)::text = ANY (ARRAY[('exploracion'::character varying)::text, ('planificacion'::character varying)::text, ('construccion'::character varying)::text, ('operacion'::character varying)::text, ('paralizado'::character varying)::text, ('cerrado'::character varying)::text]))),
    CONSTRAINT proyectos_geometria_tipo_check CHECK (((geometria_tipo)::text = ANY (ARRAY[('Point'::character varying)::text, ('LineString'::character varying)::text, ('Polygon'::character varying)::text, ('MultiPolygon'::character varying)::text])))
);


--
-- Name: proyectos_capas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proyectos_capas (
    proyecto_id uuid NOT NULL,
    capa_id uuid NOT NULL
);


--
-- Name: regiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regiones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(5) NOT NULL,
    nombre character varying(100) NOT NULL,
    capital character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: activos_mapa activos_mapa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activos_mapa
    ADD CONSTRAINT activos_mapa_pkey PRIMARY KEY (id);


--
-- Name: capas capas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas
    ADD CONSTRAINT capas_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_slug_key UNIQUE (slug);


--
-- Name: proyectos_capas proyectos_capas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos_capas
    ADD CONSTRAINT proyectos_capas_pkey PRIMARY KEY (proyecto_id, capa_id);


--
-- Name: proyectos proyectos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_pkey PRIMARY KEY (id);


--
-- Name: regiones regiones_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regiones
    ADD CONSTRAINT regiones_codigo_key UNIQUE (codigo);


--
-- Name: regiones regiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regiones
    ADD CONSTRAINT regiones_pkey PRIMARY KEY (id);


--
-- Name: idx_proyectos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proyectos_categoria ON public.proyectos USING btree (categoria_id);


--
-- Name: idx_proyectos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proyectos_estado ON public.proyectos USING btree (estado);


--
-- Name: idx_proyectos_latitud_longitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proyectos_latitud_longitud ON public.proyectos USING btree (latitud, longitud);


--
-- Name: idx_proyectos_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proyectos_region ON public.proyectos USING btree (region_id);


--
-- Name: capas capas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas
    ADD CONSTRAINT capas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: proyectos_capas proyectos_capas_capa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos_capas
    ADD CONSTRAINT proyectos_capas_capa_id_fkey FOREIGN KEY (capa_id) REFERENCES public.capas(id) ON DELETE CASCADE;


--
-- Name: proyectos_capas proyectos_capas_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos_capas
    ADD CONSTRAINT proyectos_capas_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id) ON DELETE CASCADE;


--
-- Name: proyectos proyectos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: proyectos proyectos_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regiones(id);


--
-- Name: proyectos proyectos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: capas Capas públicas son visibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Capas públicas son visibles" ON public.capas FOR SELECT USING (((publico = true) OR (auth.uid() = user_id)));


--
-- Name: categorias Categorías son públicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Categorías son públicas" ON public.categorias FOR SELECT USING (true);


--
-- Name: proyectos Proyectos visibles son públicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proyectos visibles son públicos" ON public.proyectos FOR SELECT USING ((visible = true));


--
-- Name: regiones Regiones son públicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Regiones son públicas" ON public.regiones FOR SELECT USING (true);


--
-- Name: activos_mapa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activos_mapa ENABLE ROW LEVEL SECURITY;

--
-- Name: proyectos_capas allow_public_read_proyectos_capas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_read_proyectos_capas ON public.proyectos_capas FOR SELECT USING (true);


--
-- Name: activos_mapa allow_public_read_visible_activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_read_visible_activos ON public.activos_mapa FOR SELECT USING ((visible = true));


--
-- Name: capas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capas ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

--
-- Name: proyectos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

--
-- Name: proyectos_capas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proyectos_capas ENABLE ROW LEVEL SECURITY;

--
-- Name: regiones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regiones ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;