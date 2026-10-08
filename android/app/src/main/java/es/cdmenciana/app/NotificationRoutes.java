package es.cdmenciana.app;

final class NotificationRoutes {
    static String route(String news,String team,String acta){
        if(news!=null&&news.matches("[a-z0-9][a-z0-9-]{0,199}"))return "#noticia="+news;
        return ("first".equals(team)||"filial".equals(team)||"infantil".equals(team))&&acta!=null&&acta.matches("[0-9]{1,12}")?"#acta="+acta+"&equipo="+team:"";
    }
}
