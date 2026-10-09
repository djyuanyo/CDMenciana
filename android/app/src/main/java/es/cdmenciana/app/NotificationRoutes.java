package es.cdmenciana.app;

final class NotificationRoutes {
    static boolean validTeam(String team){return team!=null&&team.matches("first|filial|infantil|rfaf_[0-9]{1,12}_[0-9]{1,12}");}
    static String route(String news,String team,String acta){
        if(news!=null&&news.matches("[a-z0-9][a-z0-9-]{0,199}"))return "#noticia="+news;
        return validTeam(team)&&acta!=null&&acta.matches("[0-9]{1,12}")?"#acta="+acta+"&equipo="+team:"";
    }
}

